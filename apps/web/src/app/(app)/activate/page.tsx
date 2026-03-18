"use client";

import { useState, useCallback, useEffect } from "react";
import NextLink from "next/link";
import {
  Wallet,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Coins,
  ShieldCheck,
  Clock,
  Zap,
  Gift,
  Link2,
  Copy,
  Check,
} from "lucide-react";

import { SGE_CONFIG, type SGETokenSymbol, explorerTxUrl, explorerAddressUrl } from "@/lib/config/sge";
import { DEMO_MODE } from "@/lib/config/demo";
import {
  type ActivationStep,
  type WalletState,
  type TokenState,
  type SettlementSummary,
  getWalletState,
  runActivationFlow,
} from "@/lib/settlement/adapter";
import { saveActivationRecord } from "@/lib/activation-store";

// ── Step labels ─────────────────────────────

const STEP_LABELS: Record<ActivationStep, string> = {
  idle: "Ready to begin",
  connecting: "Connecting wallet…",
  checking_network: "Verifying Ethereum Mainnet…",
  checking_eligibility: "Checking activation eligibility…",
  checking_balance: "Checking token balance…",
  approval_needed: "Stablecoin approval required",
  approving: "Requesting token approval…",
  approval_pending: "Waiting for approval confirmation…",
  ready_to_activate: "Ready to activate position",
  activating: "Submitting activation…",
  settled: "Settlement Confirmed",
  failed: "Activation failed",
};

// ── Phase indicator ─────────────────────────

type Phase = "register" | "activate" | "grow";

function PhaseIndicator({ phase }: { phase: Phase }) {
  const phases: { key: Phase; label: string; icon: React.ReactNode }[] = [
    { key: "register", label: "Register", icon: <Wallet className="w-4 h-4" /> },
    { key: "activate", label: "Activate", icon: <Zap className="w-4 h-4" /> },
    { key: "grow", label: "Grow", icon: <Gift className="w-4 h-4" /> },
  ];

  const currentIdx = phases.findIndex((p) => p.key === phase);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {phases.map((p, i) => {
        const isActive = i === currentIdx;
        const isComplete = i < currentIdx;
        return (
          <div key={p.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-px ${
                  isComplete ? "bg-emerald-500" : "bg-white/10"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : isComplete
                  ? "bg-emerald-500/10 text-emerald-400/60 border border-emerald-500/20"
                  : "bg-white/[0.02] text-white/30 border border-white/[0.06]"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                p.icon
              )}
              {p.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Settlement Summary Card ─────────────────

function SettlementCard({ summary }: { summary: SettlementSummary }) {
  const [copied, setCopied] = useState(false);

  const copyTxHash = () => {
    navigator.clipboard.writeText(summary.claimTxHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
      <div className="flex items-center gap-2 text-emerald-400 font-semibold">
        <CheckCircle2 className="w-5 h-5" />
        Settlement Confirmed
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-white/30 text-xs mb-1">Wallet</div>
          <a
            href={summary.walletExplorerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-mono text-xs hover:text-emerald-400 transition flex items-center gap-1"
          >
            {summary.wallet.slice(0, 6)}…{summary.wallet.slice(-4)}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div>
          <div className="text-white/30 text-xs mb-1">Contribution Token</div>
          <div className="text-white font-medium">{summary.tokenPaid}</div>
        </div>
        <div>
          <div className="text-white/30 text-xs mb-1">Amount Paid</div>
          <div className="text-white font-medium">{summary.amountPaid}</div>
        </div>
        <div>
          <div className="text-white/30 text-xs mb-1">SGE Received</div>
          <div className="text-emerald-400 font-bold">{summary.sgeReceived}</div>
        </div>
        <div>
          <div className="text-white/30 text-xs mb-1">Block Number</div>
          <div className="text-white font-mono text-xs">{summary.blockNumber.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-white/30 text-xs mb-1">Status</div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            Activated
          </div>
        </div>
      </div>

      {/* TX hashes */}
      <div className="pt-3 border-t border-white/[0.06] space-y-2">
        {summary.approveTxHash && summary.approveTxHash !== "already-approved" && (
          <a
            href={explorerTxUrl(summary.approveTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-white/40 hover:text-emerald-400 transition"
          >
            <Clock className="w-3 h-3" />
            Approval Tx: {summary.approveTxHash.slice(0, 20)}…
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <div className="flex items-center gap-2">
          <a
            href={summary.explorerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-white/40 hover:text-emerald-400 transition flex-1"
          >
            <CheckCircle2 className="w-3 h-3" />
            Claim Tx: {summary.claimTxHash.slice(0, 20)}…
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={copyTxHash}
            className="text-white/20 hover:text-white/60 transition"
            title="Copy tx hash"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Monthly Rewards Section ─────────────────

function MonthlyRewardsSection({ activated }: { activated: boolean }) {
  const monthlyAmount = 100;
  const totalMonths = 12;
  const currentMonth = 0; // placeholder
  const nextClaimDate = new Date();
  nextClaimDate.setMonth(nextClaimDate.getMonth() + 1);
  nextClaimDate.setDate(1);

  if (!activated) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
      <div className="flex items-center gap-2 text-white font-semibold">
        <Gift className="w-5 h-5 text-emerald-400" />
        Monthly Reward Eligibility
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{monthlyAmount}</div>
          <div className="text-xs text-white/30 mt-1">SGE / Month</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <div className="text-2xl font-bold text-white">{currentMonth}/{totalMonths}</div>
          <div className="text-xs text-white/30 mt-1">Claimed</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <div className="text-sm font-bold text-white">
            {nextClaimDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
          <div className="text-xs text-white/30 mt-1">Next Eligible</div>
        </div>
      </div>

      <button
        disabled
        className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-6 py-3 text-sm font-medium text-white/30 cursor-not-allowed"
      >
        <span className="flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" />
          Monthly claim not yet available
        </span>
      </button>

      <div className="text-xs text-white/20 text-center">
        Collect & claim {monthlyAmount} SGE Tokens monthly for {totalMonths} months.
        Eligibility resets on the 1st of each month.
      </div>
    </div>
  );
}

// ── Referral Section ────────────────────────

function ReferralSection({ wallet, activated }: { wallet: string | null; activated: boolean }) {
  const [copied, setCopied] = useState(false);

  if (!activated || !wallet) return null;

  const referralLink = `https://sge.foundation/activate?ref=${wallet.slice(0, 10)}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
      <div className="flex items-center gap-2 text-white font-semibold">
        <Link2 className="w-5 h-5 text-emerald-400" />
        Referral Program
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <span className="text-xs text-white/50 font-mono truncate flex-1">
          {referralLink}
        </span>
        <button
          onClick={copyLink}
          className="text-white/30 hover:text-emerald-400 transition shrink-0"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="text-xs text-white/20">
        Share your referral link to grow the ecosystem. Referral tracking is active for activated wallets.
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────

export default function FoundationActivationPage() {
  const [step, setStep] = useState<ActivationStep>("idle");
  const [selectedToken, setSelectedToken] = useState<SGETokenSymbol>("USDC");
  const [contributionAmount] = useState(SGE_CONFIG.claimAmountHuman);
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [tokenState, setTokenState] = useState<TokenState | null>(null);
  const [settlement, setSettlement] = useState<SettlementSummary | null>(null);
  const [approveTxHash, setApproveTxHash] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isProcessing = ![
    "idle",
    "settled",
    "failed",
    "approval_needed",
    "ready_to_activate",
  ].includes(step);

  const isSettled = step === "settled" && settlement !== null;

  // Determine phase
  const phase: Phase = isSettled
    ? "grow"
    : step === "idle"
    ? "register"
    : "activate";

  // Pre-check wallet state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      getWalletState().then(setWalletState);
    }
  }, []);

  const handleActivate = useCallback(async () => {
    setError(null);
    setSettlement(null);
    setApproveTxHash(null);
    setClaimTxHash(null);

    try {
      const summary = await runActivationFlow(selectedToken, (update) => {
        setStep(update.step);
        if (update.walletState) setWalletState(update.walletState);
        if (update.tokenState) setTokenState(update.tokenState);
        if (update.approveTxHash) setApproveTxHash(update.approveTxHash);
        if (update.claimTxHash) setClaimTxHash(update.claimTxHash);
        if (update.settlement) setSettlement(update.settlement);
        if (update.error) setError(update.error);
      });
      setSettlement(summary);

      // Persist record for the activation dashboard
      if (summary) {
        saveActivationRecord({
          wallet: summary.wallet,
          token: summary.tokenPaid as SGETokenSymbol,
          amountPaid: parseFloat(summary.amountPaid) || 0,
          sgeReceived: parseFloat(summary.sgeReceived) || 0,
          claimTxHash: summary.claimTxHash,
          approveTxHash: summary.approveTxHash ?? null,
          blockNumber: summary.blockNumber,
          timestamp: new Date().toISOString(),
          activated: true,
        });
      }
    } catch {
      // Error already set via callback
    }
  }, [selectedToken]);

  const handleReset = () => {
    setStep("idle");
    setError(null);
    setSettlement(null);
    setApproveTxHash(null);
    setClaimTxHash(null);
    setTokenState(null);
  };

  const tokens = Object.entries(SGE_CONFIG.tokens) as [
    SGETokenSymbol,
    (typeof SGE_CONFIG.tokens)[SGETokenSymbol],
  ][];

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Foundation Activation</h1>
        <p className="text-sm text-white/40 mt-1">
          Secure your foundational position — complete your one-time foundation contribution and activate your SGE allocation.
        </p>
        {DEMO_MODE && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            Demo Mode — transactions are simulated
          </div>
        )}
      </div>

      {/* Phase indicator */}
      <PhaseIndicator phase={phase} />

      {/* ── REGISTER PHASE ── */}
      {phase === "register" && step === "idle" && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm text-white/60">
              <span className="text-emerald-400 font-medium">
                Complete your account setup and finalize your one-time foundation contribution.
              </span>{" "}
              Receive{" "}
              <span className="text-white font-medium">
                {SGE_CONFIG.sgeReward.toLocaleString()} SGE Tokens instantly
              </span>{" "}
              upon activation, plus{" "}
              <span className="text-white font-medium">100 SGE monthly for 12 months</span>.
            </div>
          </div>

          {/* Wallet status */}
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            {walletState?.connected ? (
              <>
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-white/60">
                  Connected:{" "}
                  <span className="text-white font-mono">
                    {walletState.address?.slice(0, 6)}…{walletState.address?.slice(-4)}
                  </span>
                </span>
              </>
            ) : (
              <>
                <div className="h-2.5 w-2.5 rounded-full bg-white/20 animate-pulse" />
                <span className="text-sm text-white/40">
                  Connect your wallet to begin
                </span>
              </>
            )}
          </div>

          {/* Token selector */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/30 mb-3">
              Select Contribution Token
            </label>
            <div className="grid grid-cols-2 gap-3">
              {tokens.map(([symbol, cfg]) => (
                <button
                  key={symbol}
                  onClick={() => setSelectedToken(symbol)}
                  className={`flex items-center gap-3 rounded-lg border p-4 transition cursor-pointer ${
                    selectedToken === symbol
                      ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                      : "border-white/[0.06] bg-white/[0.01] text-white/50 hover:border-white/10 hover:text-white/70"
                  }`}
                >
                  <Coins className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium text-sm">{symbol}</div>
                    <div className="text-xs text-white/30">{cfg.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Contribution amount */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <label className="block text-xs uppercase tracking-wider text-white/30 mb-2">
              Foundation Contribution
            </label>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-white">
                {contributionAmount} {selectedToken}
              </div>
              <ArrowRight className="w-5 h-5 text-emerald-400" />
              <div className="text-right">
                <div className="text-2xl font-bold text-emerald-400">
                  {SGE_CONFIG.sgeReward.toLocaleString()} SGE
                </div>
                <div className="text-xs text-white/30">instant allocation</div>
              </div>
            </div>
          </div>

          {/* Activate button */}
          <button
            onClick={handleActivate}
            className="w-full rounded-lg bg-emerald-500 border border-emerald-500 px-6 py-4 text-sm font-semibold text-white hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/25"
          >
            <span className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              Activate Position
            </span>
          </button>
        </div>
      )}

      {/* ── ACTIVATE PHASE (PROCESSING) ── */}
      {phase === "activate" && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 space-y-6">
          {/* Connected wallet */}
          {walletState?.address && (
            <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-white/60">
                Connected:{" "}
                <span className="text-white font-mono">
                  {walletState.address.slice(0, 6)}…{walletState.address.slice(-4)}
                </span>
              </span>
            </div>
          )}

          {/* Token & amount summary */}
          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-center">
              <div className="text-xs text-white/30 uppercase tracking-wider mb-1">You Pay</div>
              <div className="text-lg font-bold text-white">
                {contributionAmount} {selectedToken}
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-400" />
            <div className="text-center">
              <div className="text-xs text-white/30 uppercase tracking-wider mb-1">You Receive</div>
              <div className="text-lg font-bold text-emerald-400">
                {SGE_CONFIG.sgeReward.toLocaleString()} SGE
              </div>
            </div>
          </div>

          {/* Token state details */}
          {tokenState && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-xs text-white/30 mb-1">Token Balance</div>
                <div className="text-white font-medium">
                  {tokenState.balance} {tokenState.symbol}
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-xs text-white/30 mb-1">Current Allowance</div>
                <div className="text-white font-medium">{tokenState.allowance} {tokenState.symbol}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-xs text-white/30 mb-1">Approval Required</div>
                <div className={`font-medium ${tokenState.approvalRequired ? "text-amber-400" : "text-emerald-400"}`}>
                  {tokenState.approvalRequired ? "Yes" : "No"}
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-xs text-white/30 mb-1">Eligibility</div>
                <div className="text-emerald-400 font-medium">Eligible</div>
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-3">
              {step === "failed" ? (
                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
              ) : (
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
              )}
              <div>
                <div
                  className={`text-sm font-medium ${
                    step === "failed" ? "text-red-400" : "text-white"
                  }`}
                >
                  {STEP_LABELS[step]}
                </div>
                {error && (
                  <div className="text-xs text-red-400/80 mt-1">{error}</div>
                )}
              </div>
            </div>

            {/* TX links */}
            {(approveTxHash || claimTxHash) && (
              <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-2">
                {approveTxHash && (
                  <a
                    href={explorerTxUrl(approveTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-white/40 hover:text-emerald-400 transition"
                  >
                    <Clock className="w-3 h-3" />
                    Approval Tx: {approveTxHash.slice(0, 18)}…
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {claimTxHash && (
                  <a
                    href={explorerTxUrl(claimTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-white/40 hover:text-emerald-400 transition"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Activation Tx: {claimTxHash.slice(0, 18)}…
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Retry button if failed */}
          {step === "failed" && (
            <button
              onClick={handleActivate}
              className="w-full rounded-lg bg-red-500/20 border border-red-500/30 px-6 py-3 text-sm font-medium text-red-300 hover:bg-red-500/30 transition"
            >
              Retry Activation
            </button>
          )}
        </div>
      )}

      {/* ── GROW PHASE (POST-SETTLEMENT) ── */}
      {isSettled && settlement && (
        <div className="space-y-6">
          {/* Settlement summary */}
          <SettlementCard summary={settlement} />

          {/* Foundational bonus */}
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-6">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
              <Zap className="w-5 h-5" />
              Foundational Bonus Delivered
            </div>
            <p className="text-sm text-white/50">
              {SGE_CONFIG.sgeReward.toLocaleString()} SGE tokens have been allocated to your wallet
              as part of the foundational activation bonus. This is your instant allocation
              for securing an early position in the SGE ecosystem.
            </p>
          </div>

          {/* Monthly rewards */}
          <MonthlyRewardsSection activated={true} />

          {/* Referral */}
          <ReferralSection wallet={walletState?.address ?? null} activated={true} />

          {/* Action buttons */}
          <div className="flex gap-3">
            <NextLink
              href="/activation-dashboard"
              className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition text-center"
            >
              View Dashboard
            </NextLink>
            <button
              onClick={handleReset}
              className="flex-1 rounded-lg bg-white/5 border border-white/[0.06] px-6 py-3 text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition"
            >
              New Activation
            </button>
          </div>
        </div>
      )}

      {/* ── NOTICES ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-3">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Important Information</h2>
        <div className="space-y-3 text-xs text-white/40 leading-relaxed">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <span>
              SGE tokens represent participation in the SGE ecosystem and governance framework.
              They are <span className="text-white/60">not an investment product</span> and carry
              no guarantee of financial return.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <span>
              Each wallet address may activate only once. The claim contract enforces this on-chain.
              Approval and activation are separate transactions requiring ETH for gas.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <span>
              Monthly reward claims are subject to the configured reward schedule. Claim eligibility
              resets monthly. Rewards are allocated upon successful activation only.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
