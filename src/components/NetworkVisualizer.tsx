import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Language } from '../data/content';
import { NetworkState } from '../shared/simWallet';
import { LightningBoltSvg } from './MarketIllustrations';

interface NetworkVisualizerProps {
  lang: Language;
  network: NetworkState | null;
}

export function NetworkVisualizer({ lang, network }: NetworkVisualizerProps) {
  if (!network) return null;

  const chan1 = network.channels[0];
  const chan2 = network.channels[1];

  return (
    <section
      aria-label={
        lang === 'fr'
          ? 'Simulation du réseau Lightning à 3 nœuds'
          : '3-node simulated Lightning network'
      }
      className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LightningBoltSvg className="w-6 h-6 shrink-0" />
          <h3 className="font-display font-bold text-lg text-[#1F2A6B]">
            {lang === 'fr'
              ? 'Comment voyagent les sats (Réseau simulé à 3 nœuds)'
              : 'How the sats travel (3-node simulated network)'}
          </h3>
        </div>
        <span
          data-testid="network-inbound-liquidity"
          className="text-sm font-bold text-[#1F2A6B] tabular-nums"
        >
          {lang === 'fr'
            ? `Capacité à recevoir sur votre étal : ${network.inboundLiquiditySats} sats`
            : `Your stall’s receiving capacity (liquidity): ${network.inboundLiquiditySats} sats`}
        </span>
      </div>

      <p className="text-[17px] text-[#1B1B1F]">
        {lang === 'fr'
          ? 'Quand le client paie votre facture, les sats glissent instantanément de son téléphone vers votre étal en passant par le Relais du Marché.'
          : 'When the customer pays your invoice, sats slide instantly from their phone to your stall through the Market Relay.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
        {/* Node 1: Customer */}
        <div className="bg-[#FFF6E5] border-2 border-[#1B1B1F] rounded-2xl p-3.5 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-[#D9582B]">
              {lang === 'fr' ? 'Nœud 1 · Départ' : 'Node 1 · Sender'}
            </div>
            <div className="font-display font-bold text-lg text-[#1B1B1F]">
              {lang === 'fr' ? 'Téléphone du Client' : 'Customer Phone'}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#1B1B1F]/15 flex items-baseline justify-between">
            <span className="text-sm text-[#1B1B1F]/80">
              {lang === 'fr' ? 'Solde client :' : 'Customer sats:'}
            </span>
            <span className="font-display font-bold text-xl text-[#1B1B1F] tabular-nums">
              {network.customerBalanceSats} sats
            </span>
          </div>
        </div>

        {/* Node 2: Market Relay Hub */}
        <div className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-3.5 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-[#1F2A6B] flex items-center gap-1.5">
              <span>{lang === 'fr' ? 'Nœud 2 · Pont' : 'Node 2 · Bridge'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="font-display font-bold text-lg text-[#1F2A6B]">
              {lang === 'fr' ? 'Relais du Marché' : 'Market Relay Node'}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#1B1B1F]/15 text-sm text-[#1B1B1F] space-y-1.5 tabular-nums">
            {chan1 && (
              <div>
                <div className="flex justify-between">
                  <span>{lang === 'fr' ? 'Canal Client ↔ Relais :' : 'Customer ↔ Relay:'}</span>
                  <span className="font-bold">
                    {chan1.fromBalanceSats} / {chan1.toBalanceSats} sats
                  </span>
                </div>
              </div>
            )}
            {chan2 && (
              <div>
                <div className="flex justify-between">
                  <span>{lang === 'fr' ? 'Canal Relais ↔ Étal :' : 'Relay ↔ Stall:'}</span>
                  <span className="font-bold">
                    {chan2.fromBalanceSats} / {chan2.toBalanceSats} sats
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Node 3: Vendor (You) */}
        <div className="bg-[#FFF6E5] border-2 border-[#2E7D4F] rounded-2xl p-3.5 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-[#2E7D4F]">
              {lang === 'fr' ? 'Nœud 3 · Arrivée ✓' : 'Node 3 · Receiver ✓'}
            </div>
            <div className="font-display font-bold text-lg text-[#1B1B1F]">
              {lang === 'fr' ? 'Votre Étal (SimWallet)' : 'Your Stall (SimWallet)'}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#1B1B1F]/15 flex items-baseline justify-between">
            <span className="text-sm text-[#1B1B1F]/80">
              {lang === 'fr' ? 'Votre caisse :' : 'Your balance:'}
            </span>
            <span
              data-testid="network-vendor-balance"
              className="font-display font-bold text-xl text-[#2E7D4F] tabular-nums"
            >
              {network.vendorBalanceSats} sats
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
