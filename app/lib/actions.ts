"use server";

import { z } from "zod";
import { supabase } from "./supabase";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FormSchema } from "./definitions";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

// Zod schema
const CreateInvoice = z.object({
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(["pending", "paid"]),
});

export async function createInvoice(formData: FormData) {
  // ✅ 1. Parse + validate form data
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // ✅ 2. Convert to cents & date
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // ✅ 3. Insert into Supabase
  const { error } = await supabase.from("invoices").insert([
    {
      customer_id: customerId,
      amount: amountInCents,
      status,
      date,
    },
  ]);

  if (error) {
    console.error("Supabase Error:", error.message);
    throw new Error("Failed to create invoice.");
  }
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);

  if (error) {
    console.error("Error deleting invoice:", error.message);
    throw new Error("Failed to delete invoice.");
  }
  revalidatePath("/dashboard/invoices");
}

// 🔒 Assuming FormSchema is already defined somewhere

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
  // ✅ Step 1: Validate and extract fields
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  const amountInCents = amount * 100;

  // ✅ Step 2: Update invoice in Supabase
  const { error } = await supabase
    .from("invoices")
    .update({
      customer_id: customerId,
      amount: amountInCents,
      status,
    })
    .eq("id", id);

  if (error) {
    console.error("Supabase Update Error:", error.message);
    throw new Error("Failed to update invoice.");
  }

  // ✅ Step 3: Refresh UI and redirect
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}
