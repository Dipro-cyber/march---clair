export type InvoiceStatus = 'PENDING' | 'PAID' | 'EXPIRED';

export interface Invoice {
  id: string;
  paymentRequest: string;
  amountSats: number;
  memo: string;
  status: InvoiceStatus;
  createdAt: number;
  expiresAt: number;
  paidAt?: number;
}

export interface SimNode {
  id: 'vendor' | 'hub' | 'customer' | 'hopA' | 'hopB';
  labelFr: string;
  labelEn: string;
  roleFr: string;
  roleEn: string;
}

export interface SimChannel {
  id: string;
  from: 'customer' | 'hub' | 'hopA' | 'hopB';
  to: 'hub' | 'vendor' | 'hopA' | 'hopB';
  capacitySats: number;
  fromBalanceSats: number;
  toBalanceSats: number;
}

export interface RouteHop {
  step: number;
  fromNodeId: string;
  toNodeId: string;
  labelFr: string;
  labelEn: string;
  forwardedSats: number;
  feeSats: number;
}

export interface PaymentComparison {
  amountSats: number;
  lightning: {
    feeSats: number;
    timeSeconds: number;
    timeLabelFr: string;
    timeLabelEn: string;
    confirmationsRequired: number;
  };
  onChain: {
    feeSats: number;
    timeMinutes: number;
    timeLabelFr: string;
    timeLabelEn: string;
    confirmationsRequired: number;
  };
}

export interface NetworkState {
  nodes: SimNode[];
  channels: SimChannel[];
  vendorBalanceSats: number;
  customerBalanceSats: number;
  inboundLiquiditySats: number;
  activeScenarioLesson: number;
  lastRouteHops?: RouteHop[];
}

/**
 * Required server-side Wallet interface implemented by both SimWallet and NwcWallet
 */
export interface Wallet {
  createInvoice(
    amountSats: number,
    memo: string,
    expirySeconds?: number
  ): Invoice | Promise<Invoice>;
  lookupInvoice(id: string): Invoice | null | Promise<Invoice | null>;
  getBalance(): number | Promise<number>;
}

export interface PaymentResult {
  ok: boolean;
  code: 'PAID' | 'INVOICE_EXPIRED' | 'ALREADY_PAID' | 'NOT_FOUND' | 'INSUFFICIENT_CAPACITY';
  invoice: Invoice | null;
  balance: number;
  network: NetworkState;
  routeHops?: RouteHop[];
}

const INITIAL_VENDOR_SATS = 1200;
const INITIAL_HUB_TO_VENDOR_SATS = 3800;
const INITIAL_CUSTOMER_SATS = 3500;
const INITIAL_HUB_TO_CUSTOMER_SATS = 1500;

// Deterministic constrained inbound capacity for Lesson 4 (Channels & Liquidity)
const LESSON_4_CONSTRAINED_INBOUND_SATS = 300;

function buildBolt11SimString(id: string, amountSats: number, memo: string): string {
  const cleanHash = Array.from(id + memo)
    .map((ch, idx) => ((ch.charCodeAt(0) + idx * 17) % 32).toString(32))
    .join('')
    .replace(/[^a-z0-9]/g, 'q')
    .padEnd(36, 'p9x4m2k8');
  return `lnbc${amountSats}n1p${cleanHash.slice(0, 36)}`;
}

export class SimWallet implements Wallet {
  private invoices: Map<string, Invoice> = new Map();
  private counter = 1;
  private nowProvider: () => number;
  private activeScenarioLesson = 1;
  private lastRouteHops: RouteHop[] | undefined = undefined;

  private nodes: SimNode[] = [
    {
      id: 'customer',
      labelFr: 'Client du Marché',
      labelEn: 'Market Customer',
      roleFr: 'Envoie les sats',
      roleEn: 'Sends sats',
    },
    {
      id: 'hub',
      labelFr: 'Relais du Marché',
      labelEn: 'Market Relay Node',
      roleFr: 'Fait passer le paiement',
      roleEn: 'Routes the payment',
    },
    {
      id: 'vendor',
      labelFr: 'Votre Étal',
      labelEn: 'Your Market Stall',
      roleFr: 'Reçoit les sats',
      roleEn: 'Receives sats',
    },
  ];

  private channels: SimChannel[] = [];

  constructor(nowProvider: () => number = () => Date.now()) {
    this.nowProvider = nowProvider;
    this.reset();
  }

  public reset(): void {
    this.invoices.clear();
    this.counter = 1;
    this.activeScenarioLesson = 1;
    this.lastRouteHops = undefined;
    this.channels = [
      {
        id: 'chan-customer-hub',
        from: 'customer',
        to: 'hub',
        capacitySats: INITIAL_CUSTOMER_SATS + INITIAL_HUB_TO_CUSTOMER_SATS,
        fromBalanceSats: INITIAL_CUSTOMER_SATS,
        toBalanceSats: INITIAL_HUB_TO_CUSTOMER_SATS,
      },
      {
        id: 'chan-hub-vendor',
        from: 'hub',
        to: 'vendor',
        capacitySats: INITIAL_HUB_TO_VENDOR_SATS + INITIAL_VENDOR_SATS,
        fromBalanceSats: INITIAL_HUB_TO_VENDOR_SATS,
        toBalanceSats: INITIAL_VENDOR_SATS,
      },
    ];
  }

  /**
   * Configures the deterministic network state for Lessons 1 to 6 so every lesson
   * behaves identically every time it is launched.
   */
  public prepareLessonScenario(lessonId: number): NetworkState {
    this.activeScenarioLesson = lessonId;
    this.lastRouteHops = undefined;

    const customerChan = this.channels.find((c) => c.from === 'customer')!;
    const vendorChan = this.channels.find((c) => c.to === 'vendor')!;

    // Ensure customer always has plenty of practice sats (at least 3,500)
    customerChan.fromBalanceSats = INITIAL_CUSTOMER_SATS;
    customerChan.toBalanceSats = INITIAL_HUB_TO_CUSTOMER_SATS;

    if (lessonId === 4) {
      // Lesson 4: Constrain inbound liquidity on the hub->vendor channel to 300 sats
      // so a 600-sat invoice fails with INSUFFICIENT_CAPACITY until topped up or reduced to 300 sats.
      vendorChan.fromBalanceSats = LESSON_4_CONSTRAINED_INBOUND_SATS;
      vendorChan.capacitySats = vendorChan.fromBalanceSats + vendorChan.toBalanceSats;
    } else {
      // Restore healthy inbound liquidity (3,800 sats) for all other lessons
      vendorChan.fromBalanceSats = INITIAL_HUB_TO_VENDOR_SATS;
      vendorChan.capacitySats = vendorChan.fromBalanceSats + vendorChan.toBalanceSats;
    }

    return this.getNetworkState();
  }

  /**
   * Lesson 4 Option A: Top up / rebalance the inbound channel capacity so the stall can receive larger payments
   */
  public topUpChannelCapacity(additionalSats = 500): NetworkState {
    const vendorChan = this.channels.find((c) => c.to === 'vendor')!;
    vendorChan.fromBalanceSats += additionalSats;
    vendorChan.capacitySats = vendorChan.fromBalanceSats + vendorChan.toBalanceSats;
    return this.getNetworkState();
  }

  /**
   * Lesson 3: Deterministic comparison between Lightning and On-Chain Bitcoin for the same sale
   */
  public comparePaymentMethods(amountSats: number): PaymentComparison {
    return {
      amountSats,
      lightning: {
        feeSats: 1,
        timeSeconds: 1,
        timeLabelFr: '1 seconde (instantané)',
        timeLabelEn: '1 second (instant)',
        confirmationsRequired: 0,
      },
      onChain: {
        feeSats: 850,
        timeMinutes: 30,
        timeLabelFr: '10 à 60 minutes (attente de confirmation)',
        timeLabelEn: '10 to 60 minutes (waiting for confirmation)',
        confirmationsRequired: 1,
      },
    };
  }

  public createInvoice(amountSats: number, memo: string, expirySeconds = 180): Invoice {
    const now = this.nowProvider();
    const id = `inv_${this.counter++}_${(now % 100000).toString(36)}`;
    const paymentRequest = buildBolt11SimString(id, amountSats, memo);
    const invoice: Invoice = {
      id,
      paymentRequest,
      amountSats,
      memo,
      status: 'PENDING',
      createdAt: now,
      expiresAt: now + expirySeconds * 1000,
    };
    this.invoices.set(id, invoice);
    return { ...invoice };
  }

  public lookupInvoice(id: string): Invoice | null {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      return null;
    }
    this.refreshStatusIfExpired(invoice);
    return { ...invoice };
  }

  public getBalance(): number {
    const vendorChannel = this.channels.find((c) => c.to === 'vendor');
    return vendorChannel ? vendorChannel.toBalanceSats : 0;
  }

  public getNetworkState(): NetworkState {
    const customerChan = this.channels.find((c) => c.from === 'customer')!;
    const vendorChan = this.channels.find((c) => c.to === 'vendor')!;
    return {
      nodes: this.nodes.map((n) => ({ ...n })),
      channels: this.channels.map((c) => ({ ...c })),
      vendorBalanceSats: vendorChan.toBalanceSats,
      customerBalanceSats: customerChan.fromBalanceSats,
      inboundLiquiditySats: vendorChan.fromBalanceSats,
      activeScenarioLesson: this.activeScenarioLesson,
      lastRouteHops: this.lastRouteHops ? this.lastRouteHops.map((h) => ({ ...h })) : undefined,
    };
  }

  public forceExpireInvoice(id: string): Invoice | null {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      return null;
    }
    if (invoice.status === 'PENDING') {
      invoice.expiresAt = this.nowProvider() - 1000;
      invoice.status = 'EXPIRED';
    }
    return { ...invoice };
  }

  public payInvoice(
    id: string,
    simulateLatePayment = false,
    multiHop = false
  ): PaymentResult {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        invoice: null,
        balance: this.getBalance(),
        network: this.getNetworkState(),
      };
    }

    if (simulateLatePayment && invoice.status === 'PENDING') {
      invoice.expiresAt = this.nowProvider() - 1000;
      invoice.status = 'EXPIRED';
    }

    this.refreshStatusIfExpired(invoice);

    if (invoice.status === 'EXPIRED') {
      return {
        ok: false,
        code: 'INVOICE_EXPIRED',
        invoice: { ...invoice },
        balance: this.getBalance(),
        network: this.getNetworkState(),
      };
    }

    if (invoice.status === 'PAID') {
      return {
        ok: false,
        code: 'ALREADY_PAID',
        invoice: { ...invoice },
        balance: this.getBalance(),
        network: this.getNetworkState(),
      };
    }

    const customerHubChan = this.channels.find((c) => c.from === 'customer' && c.to === 'hub')!;
    const hubVendorChan = this.channels.find((c) => c.from === 'hub' && c.to === 'vendor')!;

    const isLesson5MultiHop = multiHop || this.activeScenarioLesson === 5;
    const hopAFee = isLesson5MultiHop ? 2 : 0;
    const hopBFee = isLesson5MultiHop ? 1 : 0;
    const totalRoutingFee = hopAFee + hopBFee;
    const totalCustomerDebit = invoice.amountSats + totalRoutingFee;

    if (
      customerHubChan.fromBalanceSats < totalCustomerDebit ||
      hubVendorChan.fromBalanceSats < invoice.amountSats
    ) {
      return {
        ok: false,
        code: 'INSUFFICIENT_CAPACITY',
        invoice: { ...invoice },
        balance: this.getBalance(),
        network: this.getNetworkState(),
      };
    }

    // Route sats across the channels
    customerHubChan.fromBalanceSats -= totalCustomerDebit;
    customerHubChan.toBalanceSats += totalCustomerDebit;

    hubVendorChan.fromBalanceSats -= invoice.amountSats;
    hubVendorChan.toBalanceSats += invoice.amountSats;

    invoice.status = 'PAID';
    invoice.paidAt = this.nowProvider();

    if (isLesson5MultiHop) {
      this.lastRouteHops = [
        {
          step: 1,
          fromNodeId: 'customer',
          toNodeId: 'hopA',
          labelFr: 'Client (Koffi) → Nœud 1 (Coopérative)',
          labelEn: 'Customer (Koffi) → Hop 1 (Co-op Node)',
          forwardedSats: invoice.amountSats + hopAFee + hopBFee,
          feeSats: hopAFee,
        },
        {
          step: 2,
          fromNodeId: 'hopA',
          toNodeId: 'hopB',
          labelFr: 'Nœud 1 (Coopérative) → Nœud 2 (Relais Grossiste)',
          labelEn: 'Hop 1 (Co-op Node) → Hop 2 (Wholesale Relay)',
          forwardedSats: invoice.amountSats + hopBFee,
          feeSats: hopBFee,
        },
        {
          step: 3,
          fromNodeId: 'hopB',
          toNodeId: 'vendor',
          labelFr: 'Nœud 2 (Relais Grossiste) → Votre Étal',
          labelEn: 'Hop 2 (Wholesale Relay) → Your Stall',
          forwardedSats: invoice.amountSats,
          feeSats: 0,
        },
      ];
    } else {
      this.lastRouteHops = undefined;
    }

    return {
      ok: true,
      code: 'PAID',
      invoice: { ...invoice },
      balance: this.getBalance(),
      network: this.getNetworkState(),
      routeHops: this.lastRouteHops,
    };
  }

  private refreshStatusIfExpired(invoice: Invoice): void {
    if (invoice.status === 'PENDING' && this.nowProvider() >= invoice.expiresAt) {
      invoice.status = 'EXPIRED';
    }
  }
}
