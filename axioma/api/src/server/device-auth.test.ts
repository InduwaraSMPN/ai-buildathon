import assert from "node:assert/strict";
import { test } from "node:test";
import {
	hashDeviceSecret,
	issueDeviceCredential,
	issueEnrolmentToken,
	validDeviceSecret,
} from "./device-auth";

test("device secrets are distinct, opaque, and verified from hashes", () => {
	const token = issueEnrolmentToken();
	const credential = issueDeviceCredential();
	assert.match(token, /^axen_[A-Za-z0-9_-]{43}$/);
	assert.match(credential, /^axdc_[A-Za-z0-9_-]{43}$/);
	const hash = hashDeviceSecret(credential);
	assert.equal(hash.includes(credential), false);
	assert.equal(validDeviceSecret(credential, hash), true);
	assert.equal(validDeviceSecret(`${credential}x`, hash), false);
	assert.equal(validDeviceSecret("", hash), false);
	assert.equal(validDeviceSecret(credential, "bad"), false);
});
