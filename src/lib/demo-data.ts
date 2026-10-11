import type { Role } from "./roles";

// Data contoh Tahap 1. Akan diganti tabel Supabase (supabase/migrations) di Tahap 2.

export type Outlet = { id: string; nama: string; kota: string; status: "pembangunan" | "operasional" | "tutup" };

export const OUTLETS: Outlet[] = [
  { id: "ruma-kopiaksa", nama: "Ruma Kopiaksa", kota: "Purbalingga", status: "operasional" },
  { id: "ruma-kedua", nama: "Ruma Outlet 2", kota: "Purwokerto", status: "pembangunan" },
];

export type Assignment = { role: Role; outletId: string | null };

export type DemoUser = {
  id: string;
  nama: string;
  login: string; // email atau no HP
  password?: string;
  pin?: string;
  assignments: Assignment[];
};

export const USERS: DemoUser[] = [
  {
    id: "u-owner",
    nama: "Owner Hazna",
    login: "owner@matur.id",
    password: "matur123",
    // satu orang bisa memegang beberapa peran (AKS-01)
    assignments: [
      { role: "owner", outletId: null },
      { role: "admin_pusat", outletId: null },
    ],
  },
  { id: "u-fin", nama: "Nurfaika", login: "finance@matur.id", password: "matur123", assignments: [{ role: "finance", outletId: null }] },
  { id: "u-hrd", nama: "HRD Pusat", login: "hrd@matur.id", password: "matur123", assignments: [{ role: "hrd", outletId: null }] },
  { id: "u-gdg", nama: "Admin Gudang", login: "gudang@matur.id", password: "matur123", assignments: [{ role: "admin_gudang", outletId: null }] },
  {
    id: "u-spv",
    nama: "SPV Kopiaksa",
    login: "spv@matur.id",
    password: "matur123",
    pin: "9999",
    assignments: [
      { role: "spv", outletId: "ruma-kopiaksa" },
      { role: "spv", outletId: "ruma-kedua" },
    ],
  },
  { id: "u-ksr", nama: "Kasir Satu", login: "kasir1", pin: "1234", assignments: [{ role: "kasir", outletId: "ruma-kopiaksa" }] },
  { id: "u-brs", nama: "Barista Satu", login: "barista1", pin: "5678", assignments: [{ role: "barista", outletId: "ruma-kopiaksa" }] },
  { id: "u-mtr", nama: "Dwi Suyoko", login: "mitra@matur.id", password: "matur123", assignments: [{ role: "mitra", outletId: "ruma-kopiaksa" }] },
  { id: "u-pic", nama: "PIC Kontraktor", login: "pic@matur.id", password: "matur123", assignments: [{ role: "pic", outletId: "ruma-kedua" }] },
];

export const outletName = (id: string | null) => (id ? OUTLETS.find((o) => o.id === id)?.nama ?? id : "Semua Outlet");
