// Shared data model. This file is copied into mobile/types and admin/src/types (see README).
export type Role = 'STUDENT' | 'STAFF' | 'ADMIN';
export type TokenStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';
export type QueueStatus = 'OPEN' | 'PAUSED' | 'CLOSED';
export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH';

export interface AppUser { uid: string; name: string; studentId: string; email: string; role: Role }

/** Static description of a campus service. Adding a new one = adding a document, no code changes. */
export interface Service {
  id: string; name: string; icon: string; description: string;
  estimatedServiceTime: number; // default minutes per token
  order: number; active: boolean;
}

/** Live queue state for a service (one document per service, id = serviceId). */
export interface Queue {
  serviceId: string;
  currentToken: number;         // token currently at the counter (0 = none yet)
  nextToken: number;            // number the next student will receive
  status: QueueStatus;
  estimatedServiceTime: number; // minutes per token, used for wait estimates
  waitingNumbers: number[];     // token numbers still WAITING, in order of arrival
}

export interface Token {
  id: string; tokenNumber: number; serviceId: string; serviceName: string;
  userId: string; userName: string; status: TokenStatus;
  positionAtJoin: number;
  createdAt: number; calledAt: number | null; completedAt: number | null;
}

export interface AppNotification {
  id: string; userId: string; title: string; body: string; type: string; read: boolean; createdAt: number;
}

export interface CrowdSettings { lowMax: number; moderateMax: number }
export const DEFAULT_CROWD: CrowdSettings = { lowMax: 5, moderateMax: 15 }; // 0-5 low, 6-15 moderate, 16+ high
