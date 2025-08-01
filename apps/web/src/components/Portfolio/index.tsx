import React from 'react';
import { apiClient } from '../../api/client';
import type { Portfolio as PortfolioType, Position } from '@pamela/shared';
import { wsEvents } from '../../config';

const Portfolio = () => {
  const [portfolio, setPortfolio] = React.useState<PortfolioType | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch portfolio data
  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getPortfolio();
      setPortfolio(data);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Initial fetch
    fetchPortfolio();

    // Connect WebSocket
    apiClient.connectWebSocket();

    // Subscribe to portfolio updates
    const unsubscribe = apiClient.on(wsEvents.PORTFOLIO_UPDATE, (update) => {
      setPortfolio((prev) => ({
        ...prev,
        ...update,
      }));
    });

    // Subscribe to position updates
    const unsubscribePosition = apiClient.on(wsEvents.POSITION_UPDATE, (update) => {
      setPortfolio((prev) => {
        if (!prev) return prev;
        
        const updatedPositions = [...prev.positions];
        const index = updatedPositions.findIndex(p => p.id === update.position.id);
        
        if (index >= 0) {
          if (update.action === 'closed') {
            updatedPositions.splice(index, 1);
          } else {
            updatedPositions[index] = update.position;
          }
        } else if (update.action === 'created') {
          updatedPositions.push(update.position);
        }
        
        return {
          ...prev,
          positions: updatedPositions,
        };
      });
    });

    // Subscribe to portfolio updates via WebSocket
    apiClient.subscribeToPortfolio();

    return () => {
      unsubscribe();
      unsubscribePosition();
      apiClient.unsubscribeFromPortfolio();
    };
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="w-1/4 bg-gray-50 p-5 border-r border-gray-200">
        <h2 className="text-xl font-bold mb-5">Portfolio</h2>
        <div className="text-gray-500">Loading portfolio...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-1/4 bg-gray-50 p-5 border-r border-gray-200">
        <h2 className="text-xl font-bold mb-5">Portfolio</h2>
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="w-1/4 bg-gray-50 p-5 border-r border-gray-200">
        <h2 className="text-xl font-bold mb-5">Portfolio</h2>
        <div className="text-gray-500">No portfolio data available</div>
      </div>
    );
  }

  return (
    <div className="w-1/4 bg-gray-50 p-5 border-r border-gray-200 overflow-y-auto">
      <h2 className="text-xl font-bold mb-5">Portfolio</h2>
      
      {/* Portfolio Summary */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
        <div className="mb-3">
          <div className="text-sm text-gray-600">Total Value</div>
          <div className="text-lg font-semibold">
            {formatCurrency(portfolio.totalValue)}
          </div>
        </div>
        <div className="mb-3">
          <div className="text-sm text-gray-600">Available</div>
          <div className="text-lg font-semibold">
            {formatCurrency(portfolio.availableBalance)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">P&L</div>
          <div className={`text-lg font-semibold ${
            portfolio.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(portfolio.totalPnl)} ({formatPercent(portfolio.totalPnlPercent)})
          </div>
        </div>
      </div>

      {/* Positions */}
      <div className="mb-4">
        <h3 className="font-semibold mb-3">Positions</h3>
        {portfolio.positions.length === 0 ? (
          <div className="text-gray-500 text-sm">No open positions</div>
        ) : (
          <ul className="space-y-2">
            {portfolio.positions.map((position) => (
              <li key={position.id} className="p-3 bg-white rounded-lg shadow-sm">
                <div className="font-medium text-sm truncate">
                  {position.marketId}
                </div>
                <div className="text-sm text-gray-600">
                  {position.shares} shares @ {formatCurrency(position.avgPrice)}
                </div>
                <div className={`text-sm ${
                  position.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(position.pnl)} ({formatPercent(position.pnlPercent)})
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Open Orders */}
      {portfolio.openOrders.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Open Orders</h3>
          <ul className="space-y-2">
            {portfolio.openOrders.map((order) => (
              <li key={order.id} className="p-3 bg-white rounded-lg shadow-sm">
                <div className="font-medium text-sm truncate">
                  {order.marketId}
                </div>
                <div className="text-sm">
                  <span className={`font-medium ${
                    order.side === 'buy' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {order.side.toUpperCase()}
                  </span>
                  {' '}{order.amount} @ {order.price ? formatCurrency(order.price) : 'Market'}
                </div>
                <div className="text-xs text-gray-500">
                  {order.status}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Portfolio;