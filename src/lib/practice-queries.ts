import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Engagement = Database["public"]["Tables"]["engagements"]["Row"];

export function useClients(firmId: string) {
  return useQuery({
    queryKey: ["clients", firmId],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("firm_id", firmId)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: ["client", clientId],
    queryFn: async (): Promise<Client | null> => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useServices(firmId: string) {
  return useQuery({
    queryKey: ["services", firmId],
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("firm_id", firmId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export type EngagementWithRefs = Engagement & {
  client: Pick<Client, "id" | "display_name" | "client_code"> | null;
  service: Pick<Service, "id" | "name" | "service_code"> | null;
};

export function useEngagements(firmId: string) {
  return useQuery({
    queryKey: ["engagements", firmId],
    queryFn: async (): Promise<EngagementWithRefs[]> => {
      const { data, error } = await supabase
        .from("engagements")
        .select(
          "*, client:clients!engagements_client_id_fkey(id,display_name,client_code), service:services!engagements_service_id_fkey(id,name,service_code)",
        )
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EngagementWithRefs[];
    },
    staleTime: 30_000,
  });
}

export function useEngagementsForClient(clientId: string) {
  return useQuery({
    queryKey: ["engagements-for-client", clientId],
    queryFn: async (): Promise<EngagementWithRefs[]> => {
      const { data, error } = await supabase
        .from("engagements")
        .select(
          "*, client:clients!engagements_client_id_fkey(id,display_name,client_code), service:services!engagements_service_id_fkey(id,name,service_code)",
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EngagementWithRefs[];
    },
  });
}

export function statusBadgeTone(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "draft":
    case "prospect":
      return "secondary";
    case "archived":
    case "inactive":
    case "cancelled":
      return "outline";
    case "completed":
      return "secondary";
    default:
      return "outline";
  }
}
