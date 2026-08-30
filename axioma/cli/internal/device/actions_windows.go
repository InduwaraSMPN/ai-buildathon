//go:build windows

package device

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const commandWaitDelay = 5 * time.Second

func runCommand(ctx context.Context, name string, args ...string) (Result, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.WaitDelay = commandWaitDelay
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.CREATE_NEW_PROCESS_GROUP | windows.CREATE_SUSPENDED}
	var job atomic.Uintptr
	cmd.Cancel = func() error {
		if handle := windows.Handle(job.Load()); handle != 0 {
			return windows.TerminateJobObject(handle, 1)
		}
		return cmd.Process.Kill()
	}
	var output cappedBuffer
	cmd.Stdout, cmd.Stderr = &output, &output
	handle, err := startCommandInJob(cmd, &job)
	if err == nil {
		err = cmd.Wait()
	}
	if handle != 0 {
		job.Store(0)
		_ = windows.CloseHandle(handle)
	}
	detail := strings.TrimSpace(output.String())
	if output.overflow {
		return Result{Detail: fmt.Sprintf("output exceeded %d bytes", maxCommandOutput)}, nil
	}
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return Result{Detail: "timed out"}, nil
	}
	if errors.Is(ctx.Err(), context.Canceled) {
		return Result{}, context.Canceled
	}
	if err != nil {
		if detail == "" {
			detail = err.Error()
		}
		return Result{Detail: detail}, nil
	}
	return Result{OK: true, Detail: detail}, nil
}

func startCommandInJob(cmd *exec.Cmd, activeJob *atomic.Uintptr) (windows.Handle, error) {
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return 0, err
	}
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	info.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
	if _, err = windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info))); err != nil {
		windows.CloseHandle(job)
		return 0, err
	}
	if err = cmd.Start(); err != nil {
		windows.CloseHandle(job)
		return 0, err
	}
	process, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(cmd.Process.Pid))
	if err == nil {
		err = windows.AssignProcessToJobObject(job, process)
		windows.CloseHandle(process)
	}
	if err == nil {
		activeJob.Store(uintptr(job))
		err = resumeProcess(uint32(cmd.Process.Pid))
	}
	if err != nil {
		activeJob.Store(0)
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		windows.CloseHandle(job)
		return 0, err
	}
	return job, nil
}

func resumeProcess(pid uint32) error {
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPTHREAD, 0)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(snapshot)
	entry := windows.ThreadEntry32{Size: uint32(unsafe.Sizeof(windows.ThreadEntry32{}))}
	for err = windows.Thread32First(snapshot, &entry); err == nil; err = windows.Thread32Next(snapshot, &entry) {
		if entry.OwnerProcessID != pid {
			continue
		}
		thread, err := windows.OpenThread(windows.THREAD_SUSPEND_RESUME, false, entry.ThreadID)
		if err != nil {
			return err
		}
		_, err = windows.ResumeThread(thread)
		windows.CloseHandle(thread)
		return err
	}
	return fmt.Errorf("find suspended thread for process %d: %w", pid, err)
}

func runAction(ctx context.Context, action string, commands []commandSpec) (Result, error) {
	var details []string
	for i, command := range commands {
		if action == "restart_user_process" && i == len(commands)-1 {
			cmd := exec.Command(command.name, command.args...)
			if err := cmd.Start(); err != nil {
				return Result{Detail: err.Error()}, nil
			}
			if err := cmd.Process.Release(); err != nil {
				return Result{Detail: err.Error()}, nil
			}
			continue
		}
		result, err := runCommand(ctx, command.name, command.args...)
		if err != nil {
			return result, err
		}
		// A missing process is harmless: restart_user_process still launches the
		// allowlisted executable. Every other command must succeed.
		if !result.OK && !(action == "restart_user_process" && i == 0) {
			return result, nil
		}
		if result.Detail != "" {
			details = append(details, result.Detail)
		}
	}
	return Result{OK: true, Detail: strings.Join(details, "\n")}, nil
}
