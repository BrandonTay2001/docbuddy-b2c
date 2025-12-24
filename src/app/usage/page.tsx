'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import { getUserProfile } from '@/lib/auth';

interface UsageData {
    year: number;
    month: number;
    minutes_used: number;
}

export default function Usage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState('');
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [currentMonthUsage, setCurrentMonthUsage] = useState<number>(0);

  useEffect(() => {
    setIsMounted(true);
    
    const fetchData = async () => {
      try {
        const user = await getUserProfile();
        if (!user) {
          throw new Error('User not found');
        }

        // Fetch usage data
        const usageResponse = await fetch(`/api/transcription/usage?userId=${user.id}`);
        if (!usageResponse.ok) {
          throw new Error('Failed to fetch usage data');
        }
        const usageData = await usageResponse.json();
        setUsageData(usageData.usage || []);

        // Find current month's usage
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentMonthData = usageData.usage?.find(
          (data: UsageData) => data.year === currentYear && data.month === currentMonth
        );
        setCurrentMonthUsage(Number(currentMonthData?.minutes_used) || 0);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load usage data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Show a simple loading state during SSR
  if (!isMounted) {
    return <div className="min-h-screen" />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent rounded-full border-t-transparent" />
      </div>
    );
  }

  const formatMonth = (month: number) => {
    const date = new Date(2000, month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-accent';
  };

  const progressPercentage = Math.min((currentMonthUsage / 120) * 100, 100);
  const progressColor = getProgressColor(progressPercentage);

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-12 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold">Usage &amp; Billing</h1>
          <Link href="/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </header>

        {error && (
          <div className="mb-6 p-3 text-sm bg-red-100 text-red-800 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {/* Current Month's Usage */}
          <div className="p-6 border border-border rounded-md bg-background">
            <h2 className="text-xl font-bold mb-4">Current Month`&apos;`s Usage</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  {formatMonth(new Date().getMonth() + 1)} {new Date().getFullYear()}
                </span>
                <span className="text-sm font-medium">
                  {Number(currentMonthUsage).toFixed(1)} / 120.0 minutes
                </span>
              </div>
              <div className="w-full h-4 bg-input rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColor} transition-all duration-300`}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Historical Usage */}
          <div className="p-6 border border-border rounded-md bg-background">
            <h2 className="text-xl font-bold mb-4">Historical Usage</h2>
            
            {usageData.filter(data => !(data.year === new Date().getFullYear() && data.month === new Date().getMonth() + 1)).length === 0 ? (
              <p className="text-muted-foreground">No historical usage</p>
            ) : (
              <div className="space-y-4">
                {usageData
                  .filter(data => !(data.year === new Date().getFullYear() && data.month === new Date().getMonth() + 1))
                  .map((data) => (
                    <div key={`${data.year}-${data.month}`} className="flex justify-between items-center p-4 bg-input rounded-md">
                      <div>
                        <span className="font-medium">{formatMonth(data.month)} {data.year}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{Number(data.minutes_used).toFixed(1)}</span>
                        <span className="text-muted-foreground ml-1">minutes</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Billing Details */}
          <div className="p-6 border border-border rounded-md bg-background">
            <h2 className="text-xl font-bold mb-4">Billing Details</h2>
            <div className="p-4 bg-input rounded-md">
              <p className="text-muted-foreground">Disabled for DocBuddy Alpha</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}