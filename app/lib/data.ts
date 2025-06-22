import { supabase } from "./supabase";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";

const ITEMS_PER_PAGE = 6;

export async function fetchRevenue() {
  try {
    const { data, error } = await supabase.from("revenue").select("*");
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        id,
        amount,
        customers (
          name,
          email,
          image_url
        )
      `)
      .order("date", { ascending: false })
      .limit(5);

    if (error) throw error;

    return data?.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    const { data: invoices, error } = await supabase.from("invoices").select("*");
    if (error) throw error;

    const numberOfInvoices = invoices.length;
    const totalPendingInvoices = invoices.filter(inv => inv.status === "pending").length;
    const numberOfCustomers = new Set(invoices.map(inv => inv.customer_id)).size;
    const totalPaidInvoices = formatCurrency(
      invoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + inv.amount, 0)
    );

    return {
      numberOfInvoices,
      totalPendingInvoices,
      numberOfCustomers,
      totalPaidInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

export async function fetchFilteredInvoices(query: string, page: number) {
  const offset = (page - 1) * ITEMS_PER_PAGE;
  let queryBuilder = supabase
    .from("invoices")
    .select(`
      id,
      amount,
      date,
      status,
      customers (
        name,
        email,
        image_url
      )
    `)
    .order("date", { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1);

  const search = query.trim();
  if (search !== "") {
    queryBuilder = queryBuilder.or(`status.ilike.%${search}%`);
  }

  const { data, error } = await queryBuilder;
  if (error) throw new Error(error.message);

  return data;
}

export async function fetchInvoicesPages(query: string) {
  try {
    const { data, error } = await supabase.from("invoices").select("id, status");
    if (error) throw error;

    const filtered = query
      ? data.filter(
          (inv) => inv.status.toLowerCase().includes(query.toLowerCase())
        )
      : data;

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, customer_id, amount, status")
      .eq("id", id)
      .single();

    if (error) throw error;

    return {
      ...data,
      amount: data.amount / 100,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select(`
        id,
        name,
        email,
        image_url,
        invoices (
          id,
          amount,
          status
        )
      `);

    if (error) throw error;

    const filtered = data
      .filter(
        (cust) =>
          cust.name.toLowerCase().includes(query.toLowerCase()) ||
          cust.email.toLowerCase().includes(query.toLowerCase())
      )
      .map((customer) => {
        const total_pending = customer.invoices
          .filter((inv) => inv.status === "pending")
          .reduce((sum, inv) => sum + inv.amount, 0);
        const total_paid = customer.invoices
          .filter((inv) => inv.status === "paid")
          .reduce((sum, inv) => sum + inv.amount, 0);

        return {
          ...customer,
          total_pending: formatCurrency(total_pending),
          total_paid: formatCurrency(total_paid),
          total_invoices: customer.invoices.length,
        };
      });

    return filtered;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
