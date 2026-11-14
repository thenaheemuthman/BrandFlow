import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Brand, BrandFormInput, BrandValidationErrors } from '../../types/brand';
import {
  BRAND_INDUSTRIES,
  hasValidationErrors,
  isFormDirty,
  normalizeBrandInput,
  validateBrandForm,
} from '../../utils/brandLogic';

interface BrandFormViewProps {
  mode: 'create' | 'edit';
  initialBrand?: Brand;
  embedded?: boolean;
  submitting: boolean;
  serverError: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSubmit: (input: BrandFormInput) => Promise<void>;
  onCancel: () => void;
}

function buildInitialValues(brand?: Brand): BrandFormInput {
  return {
    brandName: brand?.brandName ?? '',
    businessDescription: brand?.businessDescription ?? '',
    industry: brand?.industry ?? '',
    productsOrServices: brand?.productsOrServices ?? '',
    targetMarket: brand?.targetMarket ?? '',
    primaryLocation: brand?.primaryLocation ?? '',
    websiteUrl: brand?.websiteUrl ?? '',
    socialLinks: brand?.socialLinks ?? '',
    existingMission: brand?.existingMission ?? '',
    existingVision: brand?.existingVision ?? '',
    marketingChallenges: brand?.marketingChallenges ?? '',
    businessGoals: brand?.businessGoals ?? '',
    competitors: brand?.competitors ?? '',
    additionalNotes: brand?.additionalNotes ?? '',
  };
}

export function BrandFormView({
  mode,
  initialBrand,
  embedded = false,
  submitting,
  serverError,
  onDirtyChange,
  onSubmit,
  onCancel,
}: BrandFormViewProps) {
  const initialValues = useMemo(
    () => buildInitialValues(initialBrand),
    [initialBrand],
  );
  const [form, setForm] = useState<BrandFormInput>(initialValues);
  const [errors, setErrors] = useState<BrandValidationErrors>({});
  const [showOptional, setShowOptional] = useState<boolean>(
    mode === 'edit' ||
      Boolean(
        initialBrand?.websiteUrl ||
          initialBrand?.socialLinks ||
          initialBrand?.existingMission ||
          initialBrand?.existingVision ||
          initialBrand?.marketingChallenges ||
          initialBrand?.businessGoals ||
          initialBrand?.competitors ||
          initialBrand?.additionalNotes,
      ),
  );

  useEffect(() => {
    setForm(initialValues);
    setErrors({});
  }, [initialValues]);

  useEffect(() => {
    onDirtyChange(isFormDirty(form, initialValues));
  }, [form, initialValues, onDirtyChange]);

  const updateField = <K extends keyof BrandFormInput>(
    field: K,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationErrors = validateBrandForm(form);
    if (hasValidationErrors(validationErrors)) {
      setErrors(validationErrors);
      if (validationErrors.websiteUrl) {
        setShowOptional(true);
      }
      return;
    }
    await onSubmit(normalizeBrandInput(form));
  };

  const inputClassName = (hasError?: boolean) =>
    `w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none ${
      hasError
        ? 'border-red-400 focus:border-red-600'
        : 'border-slate-200 focus:border-blue-600'
    }`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        {embedded ? (
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Brand Profile Settings
          </h2>
        ) : (
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {mode === 'create'
              ? 'Create New Brand'
              : `Edit ${initialBrand?.brandName ?? 'Brand'}`}
          </h1>
        )}
        <p className="mt-1.5 text-sm text-slate-600">
          {mode === 'create'
            ? 'Provide the core facts about your business. Once saved, you will enter your dedicated brand workspace.'
            : 'Update your foundational brand profile. Changes are saved immediately to your workspace.'}
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Required Information */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Required Information
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Essential details used to structure your brand workspace and future strategy modules.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="brand-name"
                className="block text-sm font-medium text-slate-800"
              >
                Brand Name <span className="text-red-600">*</span>
              </label>
              <input
                id="brand-name"
                name="brandName"
                type="text"
                required
                value={form.brandName}
                onChange={(e) => updateField('brandName', e.target.value)}
                placeholder="e.g., Northstar Analytics"
                aria-invalid={Boolean(errors.brandName)}
                aria-describedby={errors.brandName ? 'brand-name-error' : undefined}
                className={`mt-1.5 min-h-[42px] ${inputClassName(Boolean(errors.brandName))}`}
              />
              {errors.brandName && (
                <p id="brand-name-error" role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {errors.brandName}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="business-description"
                className="block text-sm font-medium text-slate-800"
              >
                Business Description <span className="text-red-600">*</span>
              </label>
              <p className="mt-0.5 text-xs text-slate-500">
                Summarize what the business does and the core value it delivers.
              </p>
              <textarea
                id="business-description"
                name="businessDescription"
                required
                rows={3}
                value={form.businessDescription}
                onChange={(e) => updateField('businessDescription', e.target.value)}
                placeholder="e.g., B2B marketing attribution platform helping SaaS revenue teams connect content and campaigns to pipeline."
                aria-invalid={Boolean(errors.businessDescription)}
                aria-describedby={
                  errors.businessDescription ? 'business-description-error' : undefined
                }
                className={`mt-1.5 ${inputClassName(Boolean(errors.businessDescription))}`}
              />
              {errors.businessDescription && (
                <p
                  id="business-description-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-red-600"
                >
                  {errors.businessDescription}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="brand-industry"
                className="block text-sm font-medium text-slate-800"
              >
                Industry or Business Category <span className="text-red-600">*</span>
              </label>
              <select
                id="brand-industry"
                name="industry"
                required
                value={form.industry}
                onChange={(e) => updateField('industry', e.target.value)}
                aria-invalid={Boolean(errors.industry)}
                aria-describedby={errors.industry ? 'brand-industry-error' : undefined}
                className={`mt-1.5 min-h-[42px] ${inputClassName(Boolean(errors.industry))}`}
              >
                <option value="">Select an industry...</option>
                {BRAND_INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
              {errors.industry && (
                <p
                  id="brand-industry-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-red-600"
                >
                  {errors.industry}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="primary-location"
                className="block text-sm font-medium text-slate-800"
              >
                Primary Business Location <span className="text-red-600">*</span>
              </label>
              <input
                id="primary-location"
                name="primaryLocation"
                type="text"
                required
                value={form.primaryLocation}
                onChange={(e) => updateField('primaryLocation', e.target.value)}
                placeholder="e.g., London, UK or Remote / North America"
                aria-invalid={Boolean(errors.primaryLocation)}
                aria-describedby={
                  errors.primaryLocation ? 'primary-location-error' : undefined
                }
                className={`mt-1.5 min-h-[42px] ${inputClassName(Boolean(errors.primaryLocation))}`}
              />
              {errors.primaryLocation && (
                <p
                  id="primary-location-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-red-600"
                >
                  {errors.primaryLocation}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="products-services"
                className="block text-sm font-medium text-slate-800"
              >
                Products or Services <span className="text-red-600">*</span>
              </label>
              <textarea
                id="products-services"
                name="productsOrServices"
                required
                rows={2}
                value={form.productsOrServices}
                onChange={(e) => updateField('productsOrServices', e.target.value)}
                placeholder="e.g., Attribution software subscription, executive onboarding, and custom analytics integrations"
                aria-invalid={Boolean(errors.productsOrServices)}
                aria-describedby={
                  errors.productsOrServices ? 'products-services-error' : undefined
                }
                className={`mt-1.5 ${inputClassName(Boolean(errors.productsOrServices))}`}
              />
              {errors.productsOrServices && (
                <p
                  id="products-services-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-red-600"
                >
                  {errors.productsOrServices}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="target-market"
                className="block text-sm font-medium text-slate-800"
              >
                Target Market <span className="text-red-600">*</span>
              </label>
              <input
                id="target-market"
                name="targetMarket"
                type="text"
                required
                value={form.targetMarket}
                onChange={(e) => updateField('targetMarket', e.target.value)}
                placeholder="e.g., VPs of Marketing and Demand Gen teams at Series A–C SaaS companies"
                aria-invalid={Boolean(errors.targetMarket)}
                aria-describedby={
                  errors.targetMarket ? 'target-market-error' : undefined
                }
                className={`mt-1.5 min-h-[42px] ${inputClassName(Boolean(errors.targetMarket))}`}
              />
              {errors.targetMarket && (
                <p
                  id="target-market-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-red-600"
                >
                  {errors.targetMarket}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Optional Information */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowOptional((prev) => !prev)}
            aria-expanded={showOptional}
            aria-label="Toggle Optional Strategic Context"
            className="flex min-h-[56px] w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50/70 rounded-xl"
          >
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Optional Strategic Context
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Website, social links, mission, vision, challenges, goals, competitors, and notes
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
              {showOptional ? (
                <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
              )}
            </span>
          </button>

          {showOptional && (
            <div className="border-t border-slate-100 p-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="website-url"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Website URL
                  </label>
                  <input
                    id="website-url"
                    name="websiteUrl"
                    type="url"
                    value={form.websiteUrl ?? ''}
                    onChange={(e) => updateField('websiteUrl', e.target.value)}
                    placeholder="https://example.com"
                    aria-invalid={Boolean(errors.websiteUrl)}
                    aria-describedby={
                      errors.websiteUrl ? 'website-url-error' : undefined
                    }
                    className={`mt-1.5 min-h-[42px] ${inputClassName(Boolean(errors.websiteUrl))}`}
                  />
                  {errors.websiteUrl && (
                    <p
                      id="website-url-error"
                      role="alert"
                      className="mt-1.5 text-xs font-medium text-red-600"
                    >
                      {errors.websiteUrl}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="social-links"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Social Media Links
                  </label>
                  <input
                    id="social-links"
                    name="socialLinks"
                    type="text"
                    value={form.socialLinks ?? ''}
                    onChange={(e) => updateField('socialLinks', e.target.value)}
                    placeholder="LinkedIn, X, Instagram handles or URLs"
                    className={`mt-1.5 min-h-[42px] ${inputClassName(false)}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="existing-mission"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Existing Brand Mission
                  </label>
                  <textarea
                    id="existing-mission"
                    name="existingMission"
                    rows={2}
                    value={form.existingMission ?? ''}
                    onChange={(e) => updateField('existingMission', e.target.value)}
                    placeholder="Current mission statement, if established"
                    className={`mt-1.5 ${inputClassName(false)}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="existing-vision"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Existing Brand Vision
                  </label>
                  <textarea
                    id="existing-vision"
                    name="existingVision"
                    rows={2}
                    value={form.existingVision ?? ''}
                    onChange={(e) => updateField('existingVision', e.target.value)}
                    placeholder="Long-term brand aspiration, if established"
                    className={`mt-1.5 ${inputClassName(false)}`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="marketing-challenges"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Current Marketing Challenges
                  </label>
                  <textarea
                    id="marketing-challenges"
                    name="marketingChallenges"
                    rows={2}
                    value={form.marketingChallenges ?? ''}
                    onChange={(e) =>
                      updateField('marketingChallenges', e.target.value)
                    }
                    placeholder="e.g., Inconsistent messaging across channels, low organic pipeline conversion"
                    className={`mt-1.5 ${inputClassName(false)}`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="business-goals"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Business Goals
                  </label>
                  <textarea
                    id="business-goals"
                    name="businessGoals"
                    rows={2}
                    value={form.businessGoals ?? ''}
                    onChange={(e) => updateField('businessGoals', e.target.value)}
                    placeholder="e.g., Expand enterprise awareness, double inbound demo requests over 6 months"
                    className={`mt-1.5 ${inputClassName(false)}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="competitors"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Competitors
                  </label>
                  <textarea
                    id="competitors"
                    name="competitors"
                    rows={2}
                    value={form.competitors ?? ''}
                    onChange={(e) => updateField('competitors', e.target.value)}
                    placeholder="Key direct or indirect competitors"
                    className={`mt-1.5 ${inputClassName(false)}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="additional-notes"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Additional Notes
                  </label>
                  <textarea
                    id="additional-notes"
                    name="additionalNotes"
                    rows={2}
                    value={form.additionalNotes ?? ''}
                    onChange={(e) => updateField('additionalNotes', e.target.value)}
                    placeholder="Any constraints, tone preferences, or reference points"
                    className={`mt-1.5 ${inputClassName(false)}`}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {submitting
              ? 'Saving...'
              : mode === 'create'
                ? 'Save and Continue'
                : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
