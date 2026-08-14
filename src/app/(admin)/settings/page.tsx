import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { removeLogo } from "@/actions/branding";
import { LogoUpload } from "./logo-upload";
import { SenderEmailForm } from "./sender-email-form";
import { ConfigForm } from "./config-form";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function SettingsPage() {
  const user = await requireRole("admin", "teacher");
  const operationId = await currentOperationId();
  const op = await prisma.operation.findUnique({ where: { id: operationId } });

  if (!op) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="page-title">Settings</h1>
        <div className="card p-6 text-sm text-muted">No operation in scope.</div>
      </div>
    );
  }

  const hasUpload = !!op.logoData;
  const logoSrc = hasUpload
    ? `data:${op.logoMime};base64,${Buffer.from(op.logoData!).toString("base64")}`
    : op.logoPath;

  const money = (v: unknown) => `${Number(v).toLocaleString("en-US")} ${op.currency}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Branding and configuration for {op.name}.</p>
      </div>

      {/* Logo */}
      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Logo</h2>
          <p className="mt-0.5 text-sm text-muted">
            Appears as the watermark on monthly PDF reports. Upload a new one any time.
          </p>
        </div>
        <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-card-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt={`${op.name} logo`} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <LogoUpload />
            <div className="flex items-center gap-3">
              <span className="badge-neutral">{hasUpload ? "Custom upload" : "Default logo"}</span>
              {hasUpload && (
                <form action={removeLogo}>
                  <button type="submit" className="text-sm font-medium text-danger hover:underline">
                    Remove
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Invite sender email */}
      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Invite sender email</h2>
          <p className="mt-0.5 text-sm text-muted">The &quot;from&quot; address for teacher/assistant invites.</p>
        </div>
        <div className="px-5 py-5">
          <SenderEmailForm defaultValue={op.senderEmail ?? ""} />
        </div>
      </section>

      {/* Password */}
      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Password</h2>
          <p className="mt-0.5 text-sm text-muted">Change the password for your account.</p>
        </div>
        <div className="px-5 py-5">
          <ChangePasswordForm />
        </div>
      </section>

      {/* Configuration */}
      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Configuration</h2>
          <p className="mt-0.5 text-sm text-muted">
            {user.role === "admin" ? "Branding, pay and deadlines — editable any time." : "Set by your admin."}
          </p>
        </div>
        <div className="px-5 py-5">
          {user.role === "admin" ? (
            <ConfigForm
              defaults={{
                brandName: op.brandName,
                brandSignature: op.brandSignature,
                currency: op.currency,
                dailyDeadlineHour: op.dailyDeadlineHour,
                weeklyDeadlineWeekday: op.weeklyDeadlineWeekday,
                weeklyDeadlineHour: op.weeklyDeadlineHour,
                perClassSalary: Number(op.perClassSalary),
                officeHourBonus: Number(op.officeHourBonus),
                lateDeduction: Number(op.lateDeduction),
                coverageAdjustment: Number(op.coverageAdjustment),
                payMultiplier: Number(op.payMultiplier),
              }}
            />
          ) : (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <Row label="Brand name" value={op.brandName} />
              <Row label="Message signature" value={op.brandSignature} />
              <Row label="Currency" value={op.currency} />
              <Row label="Per-class salary" value={money(op.perClassSalary)} />
              <Row label="Office-hour bonus" value={money(op.officeHourBonus)} />
              <Row label="Late deduction" value={money(op.lateDeduction)} />
              <Row label="Coverage adjustment" value={money(op.coverageAdjustment)} />
            </dl>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{value}</dd>
    </div>
  );
}
