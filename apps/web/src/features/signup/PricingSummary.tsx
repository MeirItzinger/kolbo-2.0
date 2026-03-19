import { formatCurrency } from "@/lib/utils";

interface LineItem {
  label: string;
  price: number;
}

interface PricingSummaryProps {
  items: LineItem[];
  interval?: string;
}

export function PricingSummary({
  items,
  interval = "/mo",
}: PricingSummaryProps) {
  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="sticky bottom-0 border-t border-surface-800 bg-surface-950/95 px-4 py-4 backdrop-blur-sm sm:px-6">
      <div className="mx-auto max-w-7xl">
        {items.length > 0 && (
          <div className="mb-3 space-y-1">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-surface-300">{item.label}</span>
                <span className="text-surface-200">
                  {formatCurrency(item.price)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-surface-800 pt-3">
          <span className="font-medium text-surface-200">Total</span>
          <span className="text-xl font-bold text-white">
            {formatCurrency(total)}
            <span className="text-sm font-normal text-surface-400">
              {interval}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
