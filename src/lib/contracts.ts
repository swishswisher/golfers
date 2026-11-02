export interface Club {
  id: string;
  name: string;
  slug: string;
  country: string;
  currency: string;
  timeZone: string;
  sports: string[];
  brandColor: string;
  isDemonstration: boolean;
  role?: string;
  suspended?: boolean;
}
export interface Session {
  id: string;
  displayName: string;
  email: string;
  isPlatformAdmin: boolean;
  clubs: (Club & { role: string })[];
}
export interface Member {
  id: string;
  name: string;
  email?: string;
  userId?: string;
  sport: string;
  status: string;
  junior?: boolean;
  directoryVisible?: boolean;
  emergencyContact?: string;
}
export interface Team {
  id: string;
  name: string;
  sport: string;
}
export interface Activity {
  id: string;
  title: string;
  description: string;
  kind: string;
  sport: string;
  startsAt: string;
  endsAt: string;
  place: string;
  capacity: number;
  priceMinor: number;
  teamId?: string;
  audience: string;
  status: string;
  registeredCount: number;
}
export interface Registration {
  id: string;
  activityId: string;
  memberId: string;
  memberName?: string;
  status: string;
  attendance: string;
  amountMinor: number;
  reservationExpiresAt?: string;
}
export interface ActivityDetail {
  canManage: boolean;
  activity: Activity;
  participants: Member[];
  registrations: Registration[];
}
export interface Conversation {
  id: string;
  title: string;
  kind: string;
  unreadCount: number;
  readThrough: number;
}
export interface Message {
  id: string;
  clientMessageId: string;
  sequence: number;
  body: string;
  senderId: string;
  senderName?: string;
  createdAt: string;
  hidden?: boolean;
}
export interface MessagePage {
  messages: Message[];
  nextCursor: number;
}
export interface Resource {
  id: string;
  name: string;
  sport: string;
  slotMinutes: number;
}
export interface Booking {
  id: string;
  resourceId: string;
  userId: string;
  title: string;
  startsAt: string;
  endsAt: string;
}
export interface ClubContent {
  id: string;
  kind: string;
  title: string;
  body: string;
  published: boolean;
}
export interface Notification {
  id: string;
  title: string;
  body: string;
  link: string;
  readAt?: string;
  createdAt: string;
}
export interface Preference {
  email: boolean;
  push: boolean;
  digest: boolean;
  language: string;
  timeZone: string;
}
export interface Payment {
  id: string;
  description?: string;
  memberId?: string;
  renewalUntil?: string;
  registrationId?: string;
  amountMinor: number;
  currency: string;
  status: string;
  purpose: string;
  reference?: string;
  refundedMinor: number;
  createdAt: string;
}
export interface Refund {
  id: string;
  paymentId: string;
  amountMinor: number;
  status: string;
  reason: string;
  createdAt: string;
}
export interface Subscription {
  id: string;
  plan: string;
  status: string;
  memberLimit: number;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
}
export interface Invoice {
  id: string;
  providerId: string;
  amountMinor: number;
  currency: string;
  status: string;
  hostedUrl?: string;
  createdAt: string;
}
export interface Billing {
  subscription: Subscription;
  invoices: Invoice[];
  onlineBillingAvailable: boolean;
  memberFeesAreSeparate: boolean;
}
export interface Audit {
  id: string;
  action: string;
  actorId?: string;
  createdAt: string;
  clubId?: string;
  resource?: string;
}
export interface Overview {
  members: number;
  activities: number;
  registrations: number;
  recordedMinor: number;
  recent: Audit[];
}
export interface Delivery {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
}
export interface Reports {
  activeMembers: number;
  registrations: { status: string; count: number }[];
  attendance: { status: string; count: number }[];
  payments: {
    status: string;
    currency: string;
    amountMinor: number;
    refundedMinor: number;
    count: number;
  }[];
  bySport: { sport: string; count: number }[];
}
export interface Enquiry {
  id: string;
  name: string;
  email: string;
  body: string;
  kind: string;
  status: string;
  createdAt: string;
}
export interface Ticket {
  id: string;
  response?: string;
  respondedAt?: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  clubId?: string;
}
export interface PlatformContent {
  id: string;
  slug: string;
  title: string;
  body: string;
  published: boolean;
}
export interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
}
export interface ModerationReport {
  id: string;
  messageId: string;
  reason: string;
  status: string;
  message: string;
  createdAt: string;
}
export const manager = (role: string) => role === "Owner" || role === "Manager";
export function money(minor: number, currency: string) {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    minor / 10 ** digits,
  );
}
export function dateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function currencyStep(currency: string) {
  return (
    1 /
    10 **
      (new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2)
  );
}
