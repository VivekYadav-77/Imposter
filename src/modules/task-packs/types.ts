export type PackStatus = "draft" | "published" | "archived";
export type TaskDifficulty = "easy" | "medium" | "hard";

export interface MapRoleDto {
  name: string;
  specialization: string;
  ability: string;
}

export interface PackItemDto {
  id: string;
  position: number;
  description: string;
  isActive: boolean;
  difficulty: TaskDifficulty;
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
  roles: MapRoleDto[];
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
  roles: MapRoleDto[];
}

export interface PublicPackDetailDto extends PublicPackSummaryDto {
  items: Array<{ position: number; description: string; difficulty: TaskDifficulty }>;
}
