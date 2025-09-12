'use client';

interface Position {
  market_id: string;
  token_id: string;
  outcome: string;
  size: string;
  avgPrice: string;
  unrealizedPnl?: number;
  realizedPnl?: number;
  market?: {
    question: string;
    end_date_iso: string;
    active: boolean;
    resolved: boolean;
    outcomes?: Array<{
      id: string;
      price: number;
      outcome: string;
    }>;
  };
}

interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  if (!positions || positions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">All Positions</h2>
        <p className="text-gray-500">No positions found</p>
      </div>
    );
  }

  const calculateTotalValue = (position: Position): number => {
    const size = typeof position.size === 'string' 
      ? parseFloat(position.size) 
      : (position.size || 0);
    const avgPrice = typeof position.avgPrice === 'string' 
      ? parseFloat(position.avgPrice) 
      : (position.avgPrice || 0);
    const currentPrice = position.market?.outcomes?.find(o => 
      o.outcome === position.outcome
    )?.price || avgPrice;
    return size * currentPrice;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getDaysUntilEnd = (dateStr: string): number => {
    const endDate = new Date(dateStr);
    return Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h2 className="text-2xl font-bold">All Positions ({positions.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Market
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                P&L
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                End Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {positions.map((position, index) => {
              // Handle avgPrice whether it's a string or number - ensure we parse correctly
              const rawAvgPrice = position.avgPrice;
              const avgPrice = rawAvgPrice 
                ? (typeof rawAvgPrice === 'string' ? parseFloat(rawAvgPrice) : rawAvgPrice)
                : 0;
              const size = typeof position.size === 'string'
                ? parseFloat(position.size)
                : (position.size || 0);
              const currentPrice = position.market?.outcomes?.find(o => 
                o.outcome === position.outcome
              )?.price || 0;
              const totalValue = calculateTotalValue(position);
              const costBasis = size * avgPrice;
              const unrealizedPnl = totalValue - costBasis;
              const pnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
              const daysUntilEnd = position.market?.end_date_iso ? getDaysUntilEnd(position.market.end_date_iso) : null;

              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {position.market?.question || `Market ${position.market_id.slice(0, 8)}...`}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      position.outcome === 'Yes' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {position.outcome}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {size.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${avgPrice.toFixed(4)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${currentPrice.toFixed(4)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    ${totalValue.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm font-medium ${unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${unrealizedPnl.toFixed(2)}
                      <span className="text-xs ml-1">
                        ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {position.market?.end_date_iso ? (
                      <div>
                        <div>{formatDate(position.market.end_date_iso)}</div>
                        {daysUntilEnd !== null && (
                          <div className={`text-xs ${daysUntilEnd < 7 ? 'text-orange-600' : 'text-gray-500'}`}>
                            {daysUntilEnd > 0 ? `${daysUntilEnd} days` : daysUntilEnd === 0 ? 'Today' : 'Ended'}
                          </div>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      position.market?.resolved 
                        ? 'bg-gray-100 text-gray-800' 
                        : position.market?.active 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {position.market?.resolved 
                        ? 'Resolved' 
                        : position.market?.active 
                          ? 'Active' 
                          : 'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={5} className="px-6 py-3 text-sm font-medium text-gray-900">
                Total
              </td>
              <td className="px-6 py-3 text-sm font-bold text-gray-900">
                ${positions.reduce((sum, pos) => sum + calculateTotalValue(pos), 0).toFixed(2)}
              </td>
              <td className="px-6 py-3">
                <div className={`text-sm font-bold ${
                  positions.reduce((sum, pos) => {
                    const size = typeof pos.size === 'string' ? parseFloat(pos.size) : (pos.size || 0);
                    const avgPrice = typeof pos.avgPrice === 'string' ? parseFloat(pos.avgPrice) : (pos.avgPrice || 0);
                    const currentPrice = pos.market?.outcomes?.find(o => 
                      o.outcome === pos.outcome
                    )?.price || avgPrice;
                    return sum + (size * (currentPrice - avgPrice));
                  }, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${positions.reduce((sum, pos) => {
                    const size = typeof pos.size === 'string' ? parseFloat(pos.size) : (pos.size || 0);
                    const avgPrice = typeof pos.avgPrice === 'string' ? parseFloat(pos.avgPrice) : (pos.avgPrice || 0);
                    const currentPrice = pos.market?.outcomes?.find(o => 
                      o.outcome === pos.outcome
                    )?.price || avgPrice;
                    return sum + (size * (currentPrice - avgPrice));
                  }, 0).toFixed(2)}
                </div>
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}