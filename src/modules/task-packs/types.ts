export type PackStatus = "draft" | "published" | "archived";

export interface PackItemDto {
  id: string;
  position: number;
  description: string;
  isActive: boolean;
}

export interface AdminPackDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: PackStatus;
  revision: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: PackItemDto[];
}

export interface AdminPackSummaryDto extends Omit<AdminPackDto, "items"> {
  itemCount: number;
  activeItemCount: number;
}

export interface PublicPackSummaryDto {
  id: string;
  name: string;
  description: string | null;
  activeTaskCount: number;
  revision: number;
}

export interface PublicPackDetailDto extends PublicPackSummaryDto {
  items: Array<{ position: number; description: string }>;
}
