import { z } from "zod";

export const id = z.string().trim().min(1);

export const nullableId = id.nullable();

export const impact = z.enum(["high", "medium", "low"]);

export const priority = z.enum(["P1", "P2", "P3", "P4"]);

export const jsonRecord = z.record(z.string(), z.unknown());

export const capability = z.enum([
	"ticket.read.own",
	"ticket.read.all",
	"ticket.create",
	"ticket.update",
	"ticket.resolve",
	"ticket.close",
	"ticket.escalate",
	"ticket.reclassify",
	"ticket.assign",
	"ticket.reopen",
	"run.start",
	"run.cancel",
	"run.read",
	"device.read",
	"device.enroll",
	"device.command",
	"stats.read",
	"problem.manage",
	"change.manage",
	"change.approve",
	"knowledge.read",
	"knowledge.manage",
	"approval.read",
	"approval.decide",
	"catalogue.manage",
	"admin.roles",
	"admin.settings",
]);
