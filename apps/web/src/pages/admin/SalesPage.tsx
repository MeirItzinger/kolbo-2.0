import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { adminListSales } from "@/api/admin";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { SalesTransaction } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  subscription: "Subscription",
  bundle: "Bundle",
  rental: "Rental",
  purchase: "Purchase",
  other: "Other",
};

const TYPE_VARIANTS: Record<string, "default" | "success" | "secondary" | "outline" | "destructive"> = {
  subscription: "default",
  bundle: "success",
  rental: "outline",
  purchase: "secondary",
  other: "destructive",
};

function formatCurrency(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  const cur = (currency ?? "usd").toUpperCase();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SalesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const salesQuery = useQuery({
    queryKey: ["admin", "sales", { page, search: debouncedSearch, typeFilter }],
    queryFn: () =>
      adminListSales({
        page,
        perPage: 25,
        search: debouncedSearch || undefined,
        type: typeFilter || undefined,
      }),
  });

  const transactions = salesQuery.data?.data ?? [];
  const meta = salesQuery.data?.meta;

  let searchTimer: ReturnType<typeof setTimeout>;
  function handleSearchChange(value: string) {
    setSearch(value);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales</h1>
          <p className="mt-1 text-sm text-surface-400">
            All transactions and payment activity
          </p>
        </div>
        {meta && (
          <div className="text-sm text-surface-400">
            {meta.total} total transaction{meta.total !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, email, or invoice…"
            className="h-10 w-full rounded-md border border-surface-700 bg-surface-900 pl-9 pr-3 text-sm text-surface-50 placeholder:text-surface-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-surface-700 bg-surface-900 px-3 text-sm text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Types</option>
          <option value="subscription">Subscription</option>
          <option value="bundle">Bundle</option>
          <option value="rental">Rental</option>
          <option value="purchase">Purchase</option>
        </select>
      </div>

      {/* Table */}
      {salesQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-surface-700 bg-surface-800/50 py-16 text-center">
          <Receipt className="mx-auto mb-4 h-12 w-12 text-surface-600" />
          <p className="text-lg font-medium text-white">No transactions found</p>
          <p className="mt-1 text-sm text-surface-400">
            Transactions will appear here when payments are processed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-surface-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700 bg-surface-800/80">
                <th className="px-4 py-3 text-left font-medium text-surface-300">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-surface-300">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left font-medium text-surface-300">
                  Customer
                </th>
                <th className="px-4 py-3 text-left font-medium text-surface-300">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-surface-300">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-surface-300">
                  Description
                </th>
                <th className="px-4 py-3 text-right font-medium text-surface-300">
                  Amount
                </th>
                <th className="px-4 py-3 text-center font-medium text-surface-300">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/50">
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-surface-400">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex h-9 items-center gap-1 rounded-md border border-surface-700 bg-surface-900 px-3 text-sm text-surface-300 transition-colors hover:bg-surface-800 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="flex h-9 items-center gap-1 rounded-md border border-surface-700 bg-surface-900 px-3 text-sm text-surface-300 transition-colors hover:bg-surface-800 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionRow({ tx }: { tx: SalesTransaction }) {
  const isFailed = tx.status === "failed";

  const statusLabel =
    tx.status === "paid"
      ? "Paid"
      : tx.status === "failed"
        ? "Failed"
        : tx.status.charAt(0).toUpperCase() + tx.status.slice(1);

  return (
    <tr className="transition-colors hover:bg-surface-800/40">
      <td className="whitespace-nowrap px-4 py-3 text-surface-300">
        {formatDate(tx.createdAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {tx.invoiceNumber ? (
          <span className="font-mono text-xs text-surface-200">
            {tx.invoiceNumber}
          </span>
        ) : tx.stripeInvoiceId ? (
          <span className="font-mono text-xs text-surface-400">
            {tx.stripeInvoiceId}
          </span>
        ) : (
          <span className="text-surface-500">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-white">
        {tx.user ? `${tx.user.firstName} ${tx.user.lastName}` : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-surface-400">
        {tx.user?.email ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Badge variant={TYPE_VARIANTS[tx.type] ?? "outline"}>
          {TYPE_LABELS[tx.type] ?? tx.type}
        </Badge>
      </td>
      <td className="max-w-[240px] truncate px-4 py-3 text-surface-300">
        {tx.description ||
          tx.channelName ||
          tx.bundleName ||
          tx.videoTitle ||
          "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-white">
        {formatCurrency(tx.amount, tx.currency)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-center">
        <Badge variant={isFailed ? "destructive" : "success"}>
          {statusLabel}
        </Badge>
      </td>
    </tr>
  );
}
