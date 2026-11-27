import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { reportSchema, researchInputSchema } from "./scout-schema";

export const findCompaniesFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ company: z.string().trim().min(1).max(200), context: z.string().max(4000) }))
  .handler(async ({ data }) => {
    const { findCompanies } = await import("./scout.server");
    return findCompanies(data.company, data.context);
  });
export const researchCompanyFn = createServerFn({ method: "POST" })
  .inputValidator(researchInputSchema)
  .handler(async ({ data }) => {
    const { researchCompany } = await import("./scout.server");
    return researchCompany(data.company, data.context, data.selected);
  });
export const draftOutreachFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ report: reportSchema, resume: z.string().trim().min(1).max(30000) }))
  .handler(async ({ data }) => {
    const { draftOutreach } = await import("./scout.server");
    return draftOutreach(data.report, data.resume);
  });