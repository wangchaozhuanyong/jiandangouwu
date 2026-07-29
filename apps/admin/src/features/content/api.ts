import type {
  AdminHero,
  CreateHeroInput,
  ReorderHeroesInput,
  UpdateHeroInput,
} from "@cloudbridge/contracts";
import { request } from "../../api";

export const getHeroes = async (signal?: AbortSignal): Promise<AdminHero[]> =>
  (await request<AdminHero[]>("/admin/heroes", { signal })).data;

export const createHero = (body: CreateHeroInput) =>
  request<AdminHero>("/admin/heroes", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateHero = (id: string, body: UpdateHeroInput) =>
  request<AdminHero>(`/admin/heroes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const reorderHeroes = (body: ReorderHeroesInput) =>
  request<AdminHero[]>("/admin/heroes/order", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
