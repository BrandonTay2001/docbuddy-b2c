'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/Button';
import { getUserProfile, signOut } from '@/lib/auth';

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    
    const fetchUser = async () => {
      try {
        const user = await getUserProfile();
        if (!user) {
          router.push('/auth/signin');
          return;
        }
        setUserName(user.email || '');
      } catch (error) {
        console.error('Error fetching user profile:', error);
        router.push('/auth/signin');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold">DocBuddy</h1>
          <div className="flex items-center gap-4">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-input transition-colors focus:outline-none"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <span>{userName}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-background border border-border z-10">
                  <div className="py-1">
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm hover:bg-input"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      Settings
                    </Link>
                    <Link
                      href="/usage"
                      className="block px-4 py-2 text-sm hover:bg-input"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      Usage & Billing
                    </Link>
                    <button
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-input"
                      onClick={handleSignOut}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Welcome to DocBuddy</h2>
          <p className="mb-6">Use DocBuddy to record, transcribe, and document your patient sessions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 border border-border rounded-md bg-background shadow-sm">
            <h3 className="text-xl font-bold mb-4">New Session</h3>
            <p className="mb-6">Start a new recording session with your patient.</p>
            <Link href="/session/new">
              <Button className="w-full md:w-auto">Start New Session</Button>
            </Link>
          </div>

          <div className="p-6 border border-border rounded-md bg-background shadow-sm">
            <h3 className="text-xl font-bold mb-4">Documents</h3>
            <p className="mb-6">View and manage your patient documents.</p>
            <Link href="/documents">
              <Button className="w-full md:w-auto">View Documents</Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}