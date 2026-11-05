// docs/api-contract.md の型。Goのリポジトリ（keitan1130/smapass-back）でOpenAPIが出たら、生成した型に置き換える

export type PartnerType = "manufacturer" | "repair_shop" | "used_shop";

export type ApiError = {
  code: string;
  message: string;
};

export type LoginRequest = { partnerId: string; password: string };
export type LoginResponse = { token: string; expiresAt: string };

export type Me = {
  partnerId: string;
  name: string;
  type: PartnerType;
  hasRegistrationNumber: boolean;
};

export type Device = {
  deviceId: string;
  displayName: string;
};

/** このサイトから送る記録の種類。訂正・取り消しはFR-P07（発表後）なので含めない */
export const RECORD_TYPES = ["repair", "part_replacement", "inspection"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export type PartOrigin = "genuine" | "compatible";

export type MaintenanceRecordRequest = {
  deviceId: string;
  recordType: RecordType;
  /** UTC・Z付き・秒まで。例 "2026-11-10T05:30:00Z" */
  workedAt: string;
  content: {
    repairArea?: string;
    parts?: { name: string; origin: PartOrigin }[];
    inspectionResult?: string;
    memo?: string;
  };
};

export type MaintenanceRecordAccepted = {
  recordId: string;
  status: "pending";
};

export type RecordStatus = "pending" | "submitted" | "confirmed" | "failed";

export type MaintenanceRecordStatus = {
  recordId: string;
  status: RecordStatus;
  txHash?: string;
  signerAddress?: string;
  error?: ApiError;
};

/** Goを呼ぶ処理の共通の形。本物（http.ts）とモック（mock.ts）が同じ形を持つ */
export interface GoClient {
  login(req: LoginRequest): Promise<LoginResponse>;
  logout(token: string): Promise<void>;
  getMe(token: string): Promise<Me>;
  getDemoDevice(token: string): Promise<Device>;
  createRecord(
    token: string,
    req: MaintenanceRecordRequest,
    idempotencyKey: string,
  ): Promise<MaintenanceRecordAccepted>;
  getRecordStatus(token: string, recordId: string): Promise<MaintenanceRecordStatus>;
}
