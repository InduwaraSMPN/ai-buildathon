import { oc } from "@orpc/contract";
import { z } from "zod";

export const healthContract = {
	healthCheck: oc.output(z.string()),
};
