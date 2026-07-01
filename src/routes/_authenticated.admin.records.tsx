import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Trash2, Calendar, Clipboard, Check, X, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/records")({
  component: AdminRecords,
});

const EXPENSE_TYPES = [
  "Tea (چائے)",
  "Lunch (کھانا)",
  "Juice/Bottle (جوس/بوتل)",
  "Fuel (پیٹرول)",
  "Payment to Sir (جناب کو ادائیگی)",
];

interface DeliveryEntry {
  id: string;
  customerType: "walk_in" | "regular";
  customerId: string;
  customerName: string;
  bottlesDelivered: string;
  pricePerBottle: string;
  paymentMode: "cash" | "card" | "online" | "pending";
  searchOpen: boolean;
  errors: Record<string, string>;
}

interface LotEntry {
  id: string;
  totalBottles: string;
  deliveries: DeliveryEntry[];
  errors: Record<string, string>;
}

interface ExpenseEntry {
  id: string;
  name: string;
  amount: string;
  errors: Record<string, string>;
}

function AdminRecords() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  
  const [selectedDate, setSelectedDate] = useState("");
  const [lots, setLots] = useState<LotEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch customers for searchable dropdown
  const customersQ = useQuery({
    queryKey: ["customers-simple-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, price_per_bottle")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const customers = customersQ.data ?? [];

  // Helper to format date
  const getYesterdayDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const addLot = () => {
    const newLot: LotEntry = {
      id: crypto.randomUUID(),
      totalBottles: "",
      deliveries: [],
      errors: {},
    };
    setLots([...lots, newLot]);
  };

  const removeLot = (lotId: string) => {
    setLots(lots.filter((l) => l.id !== lotId));
  };

  const updateLotBottles = (lotId: string, value: string) => {
    setLots(
      lots.map((l) => {
        if (l.id === lotId) {
          return { ...l, totalBottles: value, errors: { ...l.errors, totalBottles: "" } };
        }
        return l;
      })
    );
  };

  const addDelivery = (lotId: string) => {
    setLots(
      lots.map((l) => {
        if (l.id === lotId) {
          const newDel: DeliveryEntry = {
            id: crypto.randomUUID(),
            customerType: "walk_in",
            customerId: "",
            customerName: "",
            bottlesDelivered: "",
            pricePerBottle: "25",
            paymentMode: "cash",
            searchOpen: false,
            errors: {},
          };
          return { ...l, deliveries: [...l.deliveries, newDel] };
        }
        return l;
      })
    );
  };

  const removeDelivery = (lotId: string, delId: string) => {
    setLots(
      lots.map((l) => {
        if (l.id === lotId) {
          return { ...l, deliveries: l.deliveries.filter((d) => d.id !== delId) };
        }
        return l;
      })
    );
  };

  const updateDelivery = (
    lotId: string,
    delId: string,
    field: keyof DeliveryEntry,
    value: any
  ) => {
    setLots(
      lots.map((l) => {
        if (l.id === lotId) {
          const updatedDels = l.deliveries.map((d) => {
            if (d.id === delId) {
              const updated = { ...d, [field]: value, errors: { ...d.errors, [field]: "" } };
              
              // Handle default price and payment mode changes based on customer type
              if (field === "customerType") {
                updated.customerId = "";
                updated.customerName = "";
                updated.pricePerBottle = value === "walk_in" ? "25" : "";
                updated.paymentMode = "cash";
              }
              
              return updated;
            }
            return d;
          });
          return { ...l, deliveries: updatedDels };
        }
        return l;
      })
    );
  };

  const addExpense = () => {
    const newExp: ExpenseEntry = {
      id: crypto.randomUUID(),
      name: "",
      amount: "",
      errors: {},
    };
    setExpenses([...expenses, newExp]);
  };

  const removeExpense = (expId: string) => {
    setExpenses(expenses.filter((e) => e.id !== expId));
  };

  const updateExpense = (expId: string, field: keyof ExpenseEntry, value: string) => {
    setExpenses(
      expenses.map((e) => {
        if (e.id === expId) {
          return { ...e, [field]: value, errors: { ...e.errors, [field]: "" } };
        }
        return e;
      })
    );
  };

  const validateForm = () => {
    let isValid = true;
    const newLots = lots.map((l) => {
      const lotErrors: Record<string, string> = {};
      const totalB = parseInt(l.totalBottles);
      if (!l.totalBottles.trim()) {
        lotErrors.totalBottles = "Total bottles is required";
        isValid = false;
      } else if (isNaN(totalB) || totalB <= 0) {
        lotErrors.totalBottles = "Bottles must be a positive integer";
        isValid = false;
      }

      if (l.deliveries.length === 0) {
        lotErrors.deliveries = "At least one delivery is required for this lot";
        isValid = false;
      }

      const newDels = l.deliveries.map((d) => {
        const delErrors: Record<string, string> = {};
        if (d.customerType === "regular" && !d.customerId) {
          delErrors.customerId = "Please select a regular customer";
          isValid = false;
        }
        
        const qty = parseInt(d.bottlesDelivered);
        if (!d.bottlesDelivered.trim()) {
          delErrors.bottlesDelivered = "Quantity is required";
          isValid = false;
        } else if (isNaN(qty) || qty <= 0) {
          delErrors.bottlesDelivered = "Must be a positive integer";
          isValid = false;
        }

        const pr = parseFloat(d.pricePerBottle);
        if (!d.pricePerBottle.trim()) {
          delErrors.pricePerBottle = "Price is required";
          isValid = false;
        } else if (isNaN(pr) || pr < 0) {
          delErrors.pricePerBottle = "Must be a non-negative number";
          isValid = false;
        }

        return { ...d, errors: delErrors };
      });

      return { ...l, deliveries: newDels, errors: lotErrors };
    });

    const newExps = expenses.map((e) => {
      const expErrors: Record<string, string> = {};
      if (!e.name) {
        expErrors.name = "Expense type is required";
        isValid = false;
      }
      const amt = parseFloat(e.amount);
      if (!e.amount.trim()) {
        expErrors.amount = "Amount is required";
        isValid = false;
      } else if (isNaN(amt) || amt <= 0) {
        expErrors.amount = "Must be a positive number";
        isValid = false;
      }
      return { ...e, errors: expErrors };
    });

    setLots(newLots);
    setExpenses(newExps);
    return isValid;
  };

  const handleSave = async () => {
    if (!selectedDate) {
      toast.error("Please select a date first");
      return;
    }

    if (lots.length === 0) {
      toast.error("At least one lot must be added before submitting");
      return;
    }

    if (!validateForm()) {
      toast.error("Please resolve the errors in the form before saving");
      return;
    }

    setIsSubmitting(true);
    try {
      const targetDate = new Date(selectedDate);
      targetDate.setHours(12, 0, 0, 0);
      const dateISO = targetDate.toISOString();

      // Loop through lots and perform inserts
      for (const lot of lots) {
        // Insert lot
        const { data: lotData, error: lotError } = await supabase
          .from("lots")
          .insert({
            worker_id: user!.id,
            total_bottles: Number(lot.totalBottles),
            status: "completed",
            created_at: dateISO,
            completed_at: dateISO,
          })
          .select()
          .single();

        if (lotError) throw lotError;

        // Insert deliveries for this lot
        const delsPayload = lot.deliveries.map((d) => ({
          lot_id: lotData.id,
          worker_id: user!.id,
          customer_id: d.customerType === "regular" ? d.customerId : null,
          customer_type: d.customerType,
          bottles_delivered: Number(d.bottlesDelivered),
          price_per_bottle: Number(d.pricePerBottle),
          total_amount: Number(d.bottlesDelivered) * Number(d.pricePerBottle),
          payment_mode: d.paymentMode,
          created_at: dateISO,
        }));

        const { error: delError } = await supabase.from("deliveries").insert(delsPayload);
        if (delError) throw delError;
      }

      // Insert expenses
      if (expenses.length > 0) {
        const expsPayload = expenses.map((e) => ({
          worker_id: user!.id,
          name: e.name,
          amount: Number(e.amount),
          created_at: dateISO,
        }));

        const { error: expError } = await supabase.from("expenses").insert(expsPayload);
        if (expError) throw expError;
      }

      // Insert notification
      const formattedDate = new Date(selectedDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      const { error: notifError } = await supabase.from("notifications").insert({
        message: `Admin manually added records for ${formattedDate}`,
        is_read: false,
        created_at: new Date().toISOString(),
        kind: "manual_entry",
      });

      if (notifError) throw notifError;

      toast.success(`Records saved for ${formattedDate}`);
      
      // Invalidate queries to refresh dashboard data
      qc.invalidateQueries();
      
      // Reset form
      setSelectedDate("");
      setLots([]);
      setExpenses([]);
      
      // Redirect to dashboard
      navigate({ to: "/admin/dashboard" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save records");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminShell title="Manual Record Entry" subtitle="Log operations data for past dates">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Step 1: Select Date */}
        <div className="card-surface p-5 space-y-4">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Select Date for Record Entry
          </label>
          <input
            type="date"
            value={selectedDate}
            max={getYesterdayDateString()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full h-11 px-4 rounded-[10px] border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {selectedDate && (
          <>
            {/* Step 2 & 3: Lots and Deliveries */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Clipboard className="h-4 w-4 text-primary" /> Lots & Deliveries
                </h3>
                <button
                  type="button"
                  onClick={addLot}
                  className="h-10 px-4 rounded-[10px] bg-white border border-[#0077B6] text-[#0077B6] hover:bg-slate-50 text-sm font-semibold inline-flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add Lot
                </button>
              </div>

              {lots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 border-2 border-dashed border-border rounded-[12px] bg-card text-center text-muted-foreground text-sm">
                  <p>No lots added yet. Click "Add Lot" to begin.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lots.map((lot, lotIndex) => (
                    <div key={lot.id} className="card-surface p-5 bg-card border border-[#E2E8F0] rounded-[12px] shadow-sm relative space-y-4">
                      {/* Lot Header */}
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <span className="font-bold text-sm text-foreground">Lot {lotIndex + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeLot(lot.id)}
                          className="h-8 w-8 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg grid place-items-center transition-colors"
                          title="Remove Lot"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>

                      {/* Total Bottles Input */}
                      <div className="w-full sm:max-w-xs">
                        <label className="text-xs font-semibold text-muted-foreground">Total Bottles Taken Out</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={lot.totalBottles}
                          onChange={(e) => updateLotBottles(lot.id, e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-[10px] border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {lot.errors.totalBottles && (
                          <p className="text-xs text-destructive mt-1 font-semibold">{lot.errors.totalBottles}</p>
                        )}
                      </div>

                      {/* Lot Deliveries */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Deliveries</label>
                          <button
                            type="button"
                            onClick={() => addDelivery(lot.id)}
                            className="h-8 px-3 rounded-lg bg-white border border-[#0077B6] text-[#0077B6] hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Delivery
                          </button>
                        </div>

                        {lot.errors.deliveries && (
                          <p className="text-xs text-destructive font-semibold">{lot.errors.deliveries}</p>
                        )}

                        {lot.deliveries.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-2">No deliveries logged for this lot yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {lot.deliveries.map((del) => {
                              const totalAmount = Number(del.bottlesDelivered || 0) * Number(del.pricePerBottle || 0);
                              
                              return (
                                <div key={del.id} className="bg-[#F8FAFC] border border-border/60 rounded-[10px] p-4 relative space-y-4">
                                  {/* Remove Delivery Button */}
                                  <button
                                    type="button"
                                    onClick={() => removeDelivery(lot.id, del.id)}
                                    className="absolute top-2 right-2 h-7 w-7 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg grid place-items-center transition-colors"
                                    title="Remove Delivery"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Customer Type Toggle */}
                                    <div>
                                      <label className="text-xs font-semibold text-muted-foreground">Customer Type</label>
                                      <div className="flex gap-2 mt-1">
                                        <button
                                          type="button"
                                          onClick={() => updateDelivery(lot.id, del.id, "customerType", "walk_in")}
                                          className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-all ${
                                            del.customerType === "walk_in"
                                              ? "bg-[#0077B6] text-white border-[#0077B6]"
                                              : "bg-white text-muted-foreground border-border hover:bg-slate-50"
                                          }`}
                                        >
                                          Walk-in
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateDelivery(lot.id, del.id, "customerType", "regular")}
                                          className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-all ${
                                            del.customerType === "regular"
                                              ? "bg-[#0077B6] text-white border-[#0077B6]"
                                              : "bg-white text-muted-foreground border-border hover:bg-slate-50"
                                          }`}
                                        >
                                          Regular Customer
                                        </button>
                                      </div>
                                    </div>

                                    {/* Regular Customer Dropdown */}
                                    {del.customerType === "regular" && (
                                      <div className="relative">
                                        <label className="text-xs font-semibold text-muted-foreground">Select Customer</label>
                                        <div className="relative mt-1">
                                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                          <input
                                            type="text"
                                            placeholder="Search customer..."
                                            value={del.customerName}
                                            onFocus={() => updateDelivery(lot.id, del.id, "searchOpen", true)}
                                            onChange={(e) => {
                                              updateDelivery(lot.id, del.id, "customerName", e.target.value);
                                              updateDelivery(lot.id, del.id, "customerId", ""); // reset selected ID on search text change
                                            }}
                                            className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-white text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                          />
                                        </div>
                                        {del.errors.customerId && (
                                          <p className="text-xs text-destructive mt-1 font-semibold">{del.errors.customerId}</p>
                                        )}

                                        {/* Dropdown Options */}
                                        {del.searchOpen && (
                                          <>
                                            <div
                                              className="fixed inset-0 z-10"
                                              onClick={() => updateDelivery(lot.id, del.id, "searchOpen", false)}
                                            />
                                            <ul className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-20 divide-y divide-border text-xs">
                                              {customers
                                                .filter((c) =>
                                                  c.name.toLowerCase().includes(del.customerName.toLowerCase())
                                                )
                                                .map((c) => (
                                                  <li
                                                    key={c.id}
                                                    onClick={() => {
                                                      updateDelivery(lot.id, del.id, "customerId", c.id);
                                                      updateDelivery(lot.id, del.id, "customerName", c.name);
                                                      updateDelivery(lot.id, del.id, "pricePerBottle", String(c.price_per_bottle));
                                                      updateDelivery(lot.id, del.id, "searchOpen", false);
                                                    }}
                                                    className="px-3 py-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                                                  >
                                                    <span>{c.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">Rs. {c.price_per_bottle}/each</span>
                                                  </li>
                                                ))}
                                              {customers.filter((c) =>
                                                c.name.toLowerCase().includes(del.customerName.toLowerCase())
                                              ).length === 0 && (
                                                <li className="px-3 py-2 text-muted-foreground text-center italic">No customer found</li>
                                              )}
                                            </ul>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* Bottles Delivered */}
                                    <div>
                                      <label className="text-xs font-semibold text-muted-foreground">Quantity</label>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={del.bottlesDelivered}
                                        onChange={(e) => updateDelivery(lot.id, del.id, "bottlesDelivered", e.target.value)}
                                        className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-white text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                      />
                                      {del.errors.bottlesDelivered && (
                                        <p className="text-xs text-destructive mt-1 font-semibold">{del.errors.bottlesDelivered}</p>
                                      )}
                                    </div>

                                    {/* Price Per Bottle */}
                                    <div>
                                      <label className="text-xs font-semibold text-muted-foreground">Price/Bottle</label>
                                      <input
                                        type="number"
                                        value={del.pricePerBottle}
                                        onChange={(e) => updateDelivery(lot.id, del.id, "pricePerBottle", e.target.value)}
                                        className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-white text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                      />
                                      {del.errors.pricePerBottle && (
                                        <p className="text-xs text-destructive mt-1 font-semibold">{del.errors.pricePerBottle}</p>
                                      )}
                                    </div>

                                    {/* Total Amount (Read-only) */}
                                    <div>
                                      <label className="text-xs font-semibold text-muted-foreground">Total Amount</label>
                                      <input
                                        type="text"
                                        value={`Rs. ${totalAmount}`}
                                        readOnly
                                        disabled
                                        className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground cursor-not-allowed outline-none"
                                      />
                                    </div>

                                    {/* Payment Mode */}
                                    <div>
                                      <label className="text-xs font-semibold text-muted-foreground">Payment Mode</label>
                                      <select
                                        value={del.paymentMode}
                                        onChange={(e) => updateDelivery(lot.id, del.id, "paymentMode", e.target.value)}
                                        className="mt-1 w-full h-9 px-2 rounded-lg border border-border bg-white text-xs outline-none focus:ring-2 focus:ring-ring"
                                      >
                                        <option value="cash">Cash</option>
                                        <option value="card">Card</option>
                                        <option value="online">Online</option>
                                        {del.customerType === "regular" && <option value="pending">Pending</option>}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 4: Add Expenses */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-primary rotate-180" /> Expenses for this day
                </h3>
                <button
                  type="button"
                  onClick={addExpense}
                  className="h-10 px-4 rounded-[10px] bg-white border border-[#0077B6] text-[#0077B6] hover:bg-slate-50 text-sm font-semibold inline-flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add Expense
                </button>
              </div>

              {expenses.length > 0 && (
                <div className="card-surface p-5 bg-card border border-border rounded-[12px] shadow-sm space-y-3">
                  {expenses.map((exp) => (
                    <div key={exp.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[#F8FAFC] border border-border/50 rounded-lg p-3 relative">
                      <button
                        type="button"
                        onClick={() => removeExpense(exp.id)}
                        className="absolute sm:static top-2 right-2 h-8 w-8 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg grid place-items-center transition-colors shrink-0"
                        title="Remove Expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 sm:pt-0">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground sm:hidden">Expense Type</label>
                          <select
                            value={exp.name}
                            onChange={(e) => updateExpense(exp.id, "name", e.target.value)}
                            className="w-full h-10 px-2 rounded-lg border border-border bg-white text-xs outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Select Expense Type</option>
                            {EXPENSE_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          {exp.errors.name && (
                            <p className="text-[11px] text-destructive mt-1 font-semibold">{exp.errors.name}</p>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-muted-foreground sm:hidden">Amount (Rs.)</label>
                          <input
                            type="number"
                            placeholder="Amount in Rs."
                            value={exp.amount}
                            onChange={(e) => updateExpense(exp.id, "amount", e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-border bg-white text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          {exp.errors.amount && (
                            <p className="text-[11px] text-destructive mt-1 font-semibold">{exp.errors.amount}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 5: Save Button */}
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className="w-full h-12 rounded-[10px] bg-primary text-primary-foreground font-bold hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              {isSubmitting ? "Saving record..." : "Save Record"}
            </button>
          </>
        )}
      </div>
    </AdminShell>
  );
}
