'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { getUserProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clinicPrompt, setClinicPrompt] = useState('');
  const [summaryPrompt, setSummaryPrompt] = useState('');

  useEffect(() => {
    setIsMounted(true);
    
    const fetchData = async () => {
      try {
        const user = await getUserProfile();
        if (!user) {
          throw new Error('User not found');
        }

        // Fetch user settings
        const settingsResponse = await fetch(`/api/settings?userId=${user.id}`);
        if (!settingsResponse.ok) {
          throw new Error('Failed to fetch settings');
        }
        const settingsData = await settingsResponse.json();
        setClinicPrompt(settingsData.settings.clinic_prompt || '');
        setSummaryPrompt(settingsData.settings.summary_prompt || '');
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleResetPassword = async () => {
    try {
      setIsResettingPassword(true);
      setError('');
      setSuccess('');

      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error('Please fill out all password fields');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match');
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (passwordError) {
        throw new Error(passwordError.message || 'Failed to update password');
      }

      setSuccess('Password updated successfully');
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      setError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSavePrompts = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      const user = await getUserProfile();
      if (!user) {
        throw new Error('User not found');
      }

      // Save prompts
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          clinicPrompt,
          summaryPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save prompts');
      }

      setSuccess('Prompts saved successfully');
    } catch (error) {
      console.error('Error saving prompts:', error);
      setError(error instanceof Error ? error.message : 'Failed to save prompts');
    } finally {
      setIsSaving(false);
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
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-12 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold">Settings</h1>
          <Link href="/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </header>

        {error && (
          <div className="mb-6 p-3 text-sm bg-red-100 text-red-800 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 text-sm bg-green-100 text-green-800 rounded-md">
            {success}
          </div>
        )}

        <div className="space-y-8">
          <div className="p-6 border border-border rounded-md bg-background">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            
            <Input
              type="password"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              fullWidth
            />
            
            <Input
              type="password"
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              fullWidth
            />
            
            <Input
              type="password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              fullWidth
            />

            <div className="mt-4 flex justify-end">
              <Button 
                onClick={handleResetPassword}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? 'Resetting Password...' : 'Reset Password'}
              </Button>
            </div>
          </div>

          <div className="p-6 border border-border rounded-md bg-background">
            <h2 className="text-xl font-bold mb-4">AI Prompts</h2>
            
            <div className="mb-4">
              <label htmlFor="clinic-prompt" className="block mb-2 text-sm font-medium">
                Clinic Prompt
              </label>
              <textarea
                id="clinic-prompt"
                value={clinicPrompt}
                onChange={(e) => setClinicPrompt(e.target.value)}
                className="input w-full min-h-32 p-3"
                placeholder="Improve the AI's diagnosis by providing a clinic profile, eg: 'My clinic specializes in treating ear nose and throat conditions'"
              />
            </div>
            
            <div>
              <label htmlFor="summary-prompt" className="block mb-2 text-sm font-medium">
                Summary System Prompt
              </label>
              <textarea
                id="summary-prompt"
                value={summaryPrompt}
                onChange={(e) => setSummaryPrompt(e.target.value)}
                className="input w-full min-h-32 p-3"
                placeholder="Enter custom instructions for how the AI should summarize sessions..."
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button 
                onClick={handleSavePrompts}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Prompts'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 