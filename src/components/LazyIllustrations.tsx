import React, { Suspense, lazy } from 'react';
import { Language, StallId } from '../data/content';

const LazyStallIllustrationInner = lazy(() =>
  import('./MarketIllustrations').then((m) => ({
    default: m.StallIllustration,
  }))
);

const LazyCustomerAvatarInner = lazy(() =>
  import('./MarketIllustrations').then((m) => ({
    default: m.CustomerAvatarSvg,
  }))
);

const LazyInvoiceQrInner = lazy(() =>
  import('./MarketIllustrations').then((m) => ({
    default: m.InvoiceQrSvg,
  }))
);

const LazyRoutingPathInner = lazy(() =>
  import('./MarketIllustrations').then((m) => ({
    default: m.RoutingPathSvg,
  }))
);

export function LazyStallIllustration(props: {
  stallId: StallId;
  className?: string;
}) {
  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className={`rounded-2xl bg-[#FFF6E5] border border-[#1F2A6B]/20 ${props.className ?? 'w-full h-36'}`}
        />
      }
    >
      <LazyStallIllustrationInner {...props} />
    </Suspense>
  );
}

export function LazyCustomerAvatarSvg(props: {
  customer: string;
  className?: string;
}) {
  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className={`rounded-2xl bg-[#FFF6E5] border border-[#1B1B1F]/30 ${props.className ?? 'w-14 h-14'}`}
        />
      }
    >
      <LazyCustomerAvatarInner {...props} />
    </Suspense>
  );
}

export function LazyInvoiceQrSvg(props: {
  paymentRequest: string;
  expired?: boolean;
  paid?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className="w-36 h-36 rounded-2xl bg-white border-2 border-[#1B1B1F] shrink-0"
        />
      }
    >
      <LazyInvoiceQrInner {...props} />
    </Suspense>
  );
}

export function LazyRoutingPathSvg(props: {
  activeStep: number;
  amountSats: number;
  lang: Language;
}) {
  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className="w-full h-28 rounded-2xl bg-[#FFF6E5] border border-[#1F2A6B]/20"
        />
      }
    >
      <LazyRoutingPathInner {...props} />
    </Suspense>
  );
}
