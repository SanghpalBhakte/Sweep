'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import {
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';

export default function SecuritySettingsPage() {
  const { isConfigured } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reauthentication state
  const [needsReauth, setNeedsReauth] = useState(false);
  const [isReauthing, setIsReauthing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all required password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured in this environment.');
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client unavailable.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Submit password update with current password
      const updatePayload: { password: string; currentPassword?: string } = {
        password: newPassword,
      };

      if (currentPassword) {
        updatePayload.currentPassword = currentPassword;
      }

      const { error: updateError } = await supabase.auth.updateUser(updatePayload);

      if (updateError) {
        // If reauthentication is required by project policy
        if (
          updateError.message.toLowerCase().includes('reauthentication') ||
          updateError.message.toLowerCase().includes('reauthenticate') ||
          (updateError as any).status === 403
        ) {
          setNeedsReauth(true);
          setError('Reauthentication is required to change password.');
        } else {
          setError(updateError.message);
        }
        setIsSubmitting(false);
        return;
      }

      setSuccess('Your password has been successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNeedsReauth(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReauthenticate = async () => {
    setError(null);
    setIsReauthing(true);

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client unavailable.');
      setIsReauthing(false);
      return;
    }

    try {
      const { error: reauthErr } = await supabase.auth.reauthenticate();

      if (reauthErr) {
        setError(reauthErr.message || 'Reauthentication failed.');
      } else {
        setSuccess('Reauthentication requested. Please check your email/auth app for confirmation.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error during reauthentication.');
    } finally {
      setIsReauthing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto py-2 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Settings</span>
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
            Password & Security
          </h1>
        </div>

        <ButtonLink href="/settings/mfa" variant="outline" size="sm" className="text-xs">
          Manage 2FA
        </ButtonLink>
      </div>

      {/* Success Alert */}
      {success ? (
        <Alert variant="success" className="animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      {/* Error Alert */}
      {error ? (
        <Alert variant="destructive" className="animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Reauthentication Required Banner */}
      {needsReauth ? (
        <Alert variant="warning" className="animate-in fade-in duration-150">
          <ShieldAlert className="w-4 h-4 shrink-0 text-warning" />
          <AlertDescription className="flex-1 flex items-center justify-between gap-3 flex-wrap">
            <span>
              Your security settings require verifying your identity before changing your password.
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleReauthenticate}
              isLoading={isReauthing}
              className="shrink-0"
            >
              Reauthenticate
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Change Password Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password to keep your Sweep account secure.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              helperText="Required if current password verification is enabled on your project."
            />

            <Input
              label="New Password"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              helperText="Must be at least 6 characters long."
            />

            <Input
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                className="text-xs font-semibold shadow-xs"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
