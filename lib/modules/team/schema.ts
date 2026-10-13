import { z } from "zod";

export const ASSIGNABLE_ROLES = ["admin", "manager", "member", "readonly"] as const;

export const memberSchema = z.object({
  full_name: z.string().trim().min(1, "Indica el nombre").max(120),
  email: z.email("Email no válido").max(200).transform((v) => v.toLowerCase()),
  role: z.enum(ASSIGNABLE_ROLES, "Elige un rol"),
  password: z
    .string()
    .max(72)
    .refine((v) => v === "" || v.length >= 8, "La contraseña debe tener al menos 8 caracteres")
    .transform((v) => (v === "" ? null : v)),
});

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });
