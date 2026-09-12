export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
        }
        Relationships: []
      }
      contracts: {
        Row: {
          canceled_at: string | null
          canceled_by: string | null
          cancellation_reason: string | null
          commercial_notes_snapshot: string | null
          contract_code: string
          contract_notes: string | null
          contractor_address_snapshot: Json | null
          contractor_cpf_snapshot: string | null
          contractor_email_snapshot: string | null
          contractor_name_snapshot: string
          contractor_person_id: string
          contractor_phone_snapshot: string | null
          course_modality_snapshot: string
          course_name_snapshot: string
          course_workload_snapshot: number | null
          created_at: string
          created_by: string | null
          discount_value_snapshot: number
          gross_value_snapshot: number
          id: string
          installments_snapshot: number
          issued_at: string | null
          net_value_snapshot: number
          payment_method_snapshot: string
          sale_id: string
          signature_confirmed_by: string | null
          signed_at: string | null
          status: string
          student_id: string
          student_name_snapshot: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          commercial_notes_snapshot?: string | null
          contract_code: string
          contract_notes?: string | null
          contractor_address_snapshot?: Json | null
          contractor_cpf_snapshot?: string | null
          contractor_email_snapshot?: string | null
          contractor_name_snapshot: string
          contractor_person_id: string
          contractor_phone_snapshot?: string | null
          course_modality_snapshot: string
          course_name_snapshot: string
          course_workload_snapshot?: number | null
          created_at?: string
          created_by?: string | null
          discount_value_snapshot?: number
          gross_value_snapshot: number
          id?: string
          installments_snapshot?: number
          issued_at?: string | null
          net_value_snapshot: number
          payment_method_snapshot: string
          sale_id: string
          signature_confirmed_by?: string | null
          signed_at?: string | null
          status?: string
          student_id: string
          student_name_snapshot: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          commercial_notes_snapshot?: string | null
          contract_code?: string
          contract_notes?: string | null
          contractor_address_snapshot?: Json | null
          contractor_cpf_snapshot?: string | null
          contractor_email_snapshot?: string | null
          contractor_name_snapshot?: string
          contractor_person_id?: string
          contractor_phone_snapshot?: string | null
          course_modality_snapshot?: string
          course_name_snapshot?: string
          course_workload_snapshot?: number | null
          created_at?: string
          created_by?: string | null
          discount_value_snapshot?: number
          gross_value_snapshot?: number
          id?: string
          installments_snapshot?: number
          issued_at?: string | null
          net_value_snapshot?: number
          payment_method_snapshot?: string
          sale_id?: string
          signature_confirmed_by?: string | null
          signed_at?: string | null
          status?: string
          student_id?: string
          student_name_snapshot?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_contractor_person_id_fkey"
            columns: ["contractor_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          code: string
          created_at: string
          created_by: string | null
          default_price: number | null
          description: string | null
          duration_unit: string | null
          duration_value: number | null
          id: string
          modality: string
          name: string
          short_name: string | null
          status: string
          updated_at: string
          updated_by: string | null
          workload_hours: number | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          default_price?: number | null
          description?: string | null
          duration_unit?: string | null
          duration_value?: number | null
          id?: string
          modality?: string
          name: string
          short_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          workload_hours?: number | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          default_price?: number | null
          description?: string | null
          duration_unit?: string | null
          duration_value?: number | null
          id?: string
          modality?: string
          name?: string
          short_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          workload_hours?: number | null
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string
          id: string
          lead_id: string
          outcome: string | null
          owner_user_id: string
          status: string
          title: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at: string
          id?: string
          lead_id: string
          outcome?: string | null
          owner_user_id: string
          status?: string
          title: string
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          id?: string
          lead_id?: string
          outcome?: string | null
          owner_user_id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_sources: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_lead_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          lead_id: string
          metadata: Json
          new_stage_id: string
          previous_stage_id: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          lead_id: string
          metadata?: Json
          new_stage_id: string
          previous_stage_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          lead_id?: string
          metadata?: Json
          new_stage_id?: string
          previous_stage_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_stage_history_new_stage_id_fkey"
            columns: ["new_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          budget_notes: string | null
          closed_at: string | null
          commercial_notes: string | null
          course_interest_id: string | null
          created_at: string
          created_by: string | null
          decision_maker: string | null
          estimated_value: number | null
          id: string
          lead_code: string
          lost_notes: string | null
          lost_reason_id: string | null
          owner_user_id: string
          person_id: string
          preferred_modality: string | null
          preferred_shift: string | null
          proposal_sent_at: string | null
          proposed_value: number | null
          qualification_start_period: string | null
          source_detail: string | null
          source_id: string | null
          stage_id: string
          status: string
          temperature: string | null
          updated_at: string
          updated_by: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          budget_notes?: string | null
          closed_at?: string | null
          commercial_notes?: string | null
          course_interest_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_maker?: string | null
          estimated_value?: number | null
          id?: string
          lead_code: string
          lost_notes?: string | null
          lost_reason_id?: string | null
          owner_user_id: string
          person_id: string
          preferred_modality?: string | null
          preferred_shift?: string | null
          proposal_sent_at?: string | null
          proposed_value?: number | null
          qualification_start_period?: string | null
          source_detail?: string | null
          source_id?: string | null
          stage_id: string
          status?: string
          temperature?: string | null
          updated_at?: string
          updated_by?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          budget_notes?: string | null
          closed_at?: string | null
          commercial_notes?: string | null
          course_interest_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_maker?: string | null
          estimated_value?: number | null
          id?: string
          lead_code?: string
          lost_notes?: string | null
          lost_reason_id?: string | null
          owner_user_id?: string
          person_id?: string
          preferred_modality?: string | null
          preferred_shift?: string | null
          proposal_sent_at?: string | null
          proposed_value?: number | null
          qualification_start_period?: string | null
          source_detail?: string | null
          source_id?: string | null
          stage_id?: string
          status?: string
          temperature?: string | null
          updated_at?: string
          updated_by?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_course_interest_id_fkey"
            columns: ["course_interest_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_lost_reason_id_fkey"
            columns: ["lost_reason_id"]
            isOneToOne: false
            referencedRelation: "crm_lost_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lost_reasons: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_pipeline_stages: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          position: number
          probability: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          position: number
          probability?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          position?: number
          probability?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          birth_date: string | null
          city: string | null
          complement: string | null
          country: string
          cpf: string | null
          created_at: string
          created_by: string | null
          district: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          number: string | null
          phone: string | null
          postal_code: string | null
          preferred_name: string | null
          rg: string | null
          state: string | null
          street: string | null
          updated_at: string
          updated_by: string | null
          whatsapp: string | null
        }
        Insert: {
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          country?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          number?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          rg?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          country?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          number?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          rg?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          module: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          module: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          module?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          canceled_at: string | null
          canceled_by: string | null
          cancellation_reason: string | null
          commercial_notes: string | null
          course_id: string
          course_name_snapshot: string
          course_price_snapshot: number | null
          created_at: string
          created_by: string | null
          discount_value: number
          gross_value: number
          id: string
          installments: number
          lead_id: string
          net_value: number | null
          payment_method: string
          person_id: string
          sale_code: string
          sale_date: string
          seller_user_id: string
          status: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          commercial_notes?: string | null
          course_id: string
          course_name_snapshot: string
          course_price_snapshot?: number | null
          created_at?: string
          created_by?: string | null
          discount_value?: number
          gross_value: number
          id?: string
          installments?: number
          lead_id: string
          net_value?: number | null
          payment_method: string
          person_id: string
          sale_code: string
          sale_date?: string
          seller_user_id: string
          status?: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          commercial_notes?: string | null
          course_id?: string
          course_name_snapshot?: string
          course_price_snapshot?: number | null
          created_at?: string
          created_by?: string | null
          discount_value?: number
          gross_value?: number
          id?: string
          installments?: number
          lead_id?: string
          net_value?: number | null
          payment_method?: string
          person_id?: string
          sale_code?: string
          sale_date?: string
          seller_user_id?: string
          status?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          created_at: string
          created_by: string | null
          guardian_person_id: string
          id: string
          is_financial_responsible: boolean
          is_legal_guardian: boolean
          is_primary_contact: boolean
          notes: string | null
          relationship: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          guardian_person_id: string
          id?: string
          is_financial_responsible?: boolean
          is_legal_guardian?: boolean
          is_primary_contact?: boolean
          notes?: string | null
          relationship: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          guardian_person_id?: string
          id?: string
          is_financial_responsible?: boolean
          is_legal_guardian?: boolean
          is_primary_contact?: boolean
          notes?: string | null
          relationship?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_guardian_person_id_fkey"
            columns: ["guardian_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          metadata: Json
          new_status: string
          previous_status: string | null
          reason: string | null
          student_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json
          new_status: string
          previous_status?: string | null
          reason?: string | null
          student_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json
          new_status?: string
          previous_status?: string | null
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_status_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          origin: string | null
          person_id: string
          registration_date: string
          status: string
          student_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          person_id: string
          registration_date?: string
          status?: string
          student_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          person_id?: string
          registration_date?: string
          status?: string
          student_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _crm_validate_stage_move: {
        Args: { p_course_interest_id?: string; p_stage_id: string }
        Returns: string
      }
      assign_crm_lead: {
        Args: { p_lead_id: string; p_new_owner_id: string }
        Returns: undefined
      }
      cancel_contract: {
        Args: { p_contract_id: string; p_reason: string }
        Returns: Json
      }
      cancel_sale: {
        Args: { p_cancellation_reason: string; p_sale_id: string }
        Returns: undefined
      }
      change_student_status: {
        Args: { p_new_status: string; p_reason?: string; p_student_id: string }
        Returns: undefined
      }
      close_crm_lead_lost: {
        Args: {
          p_lead_id: string
          p_lost_notes?: string
          p_lost_reason_id: string
        }
        Returns: undefined
      }
      complete_crm_activity: {
        Args: { p_activity_id: string; p_outcome?: string }
        Returns: undefined
      }
      create_contract_from_sale: {
        Args: {
          p_contract_notes?: string
          p_contractor_person_id: string
          p_sale_id: string
        }
        Returns: Json
      }
      create_course: {
        Args: {
          p_category?: string
          p_code: string
          p_default_price?: number
          p_description?: string
          p_duration_unit?: string
          p_duration_value?: number
          p_modality?: string
          p_name: string
          p_short_name?: string
          p_workload_hours?: number
        }
        Returns: string
      }
      create_crm_activity: {
        Args: {
          p_description?: string
          p_due_at: string
          p_lead_id: string
          p_owner_user_id?: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      create_crm_lead: {
        Args: {
          p_commercial_notes?: string
          p_course_interest_id?: string
          p_cpf?: string
          p_email?: string
          p_first_activity_due_at?: string
          p_first_activity_title?: string
          p_first_activity_type?: string
          p_full_name: string
          p_owner_user_id?: string
          p_phone?: string
          p_source_code?: string
          p_stage_id?: string
          p_temperature?: string
          p_whatsapp?: string
        }
        Returns: string
      }
      create_person: {
        Args: {
          p_birth_date?: string
          p_city?: string
          p_complement?: string
          p_cpf?: string
          p_district?: string
          p_email?: string
          p_emergency_contact_name?: string
          p_emergency_contact_phone?: string
          p_full_name: string
          p_notes?: string
          p_number?: string
          p_phone?: string
          p_postal_code?: string
          p_preferred_name?: string
          p_rg?: string
          p_state?: string
          p_street?: string
          p_whatsapp?: string
        }
        Returns: Json
      }
      create_sale_from_lead: {
        Args: {
          p_commercial_notes?: string
          p_course_id: string
          p_discount_value?: number
          p_gross_value: number
          p_installments?: number
          p_lead_id: string
          p_payment_method: string
        }
        Returns: Json
      }
      create_student: {
        Args: {
          p_birth_date?: string
          p_city?: string
          p_complement?: string
          p_cpf?: string
          p_district?: string
          p_email?: string
          p_emergency_contact_name?: string
          p_emergency_contact_phone?: string
          p_full_name: string
          p_notes?: string
          p_number?: string
          p_origin?: string
          p_phone?: string
          p_postal_code?: string
          p_preferred_name?: string
          p_rg?: string
          p_state?: string
          p_street?: string
          p_whatsapp?: string
        }
        Returns: string
      }
      crm_activity_agenda: {
        Args: {
          p_owner_user_id?: string
          p_page?: number
          p_page_size?: number
        }
        Returns: Json
      }
      crm_dashboard_kpis: { Args: never; Returns: Json }
      get_contract_detail: { Args: { p_contract_id: string }; Returns: Json }
      get_contract_timeline: { Args: { p_contract_id: string }; Returns: Json }
      get_contractor_detail: { Args: { p_person_id: string }; Returns: Json }
      get_crm_lead_detail: { Args: { p_lead_id: string }; Returns: Json }
      get_crm_lead_timeline: {
        Args: { p_lead_id: string; p_page?: number; p_page_size?: number }
        Returns: Json
      }
      get_my_permissions: { Args: never; Returns: string[] }
      get_sale_detail: { Args: { p_sale_id: string }; Returns: Json }
      get_sale_timeline: { Args: { p_sale_id: string }; Returns: Json }
      get_student_detail: { Args: { p_student_id: string }; Returns: Json }
      get_student_history: { Args: { p_student_id: string }; Returns: Json }
      has_permission: {
        Args: { requested_permission: string }
        Returns: boolean
      }
      has_role: { Args: { requested_role: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      issue_contract: { Args: { p_contract_id: string }; Returns: Json }
      link_guardian: {
        Args: {
          p_cpf?: string
          p_email?: string
          p_full_name: string
          p_is_financial_responsible?: boolean
          p_is_legal_guardian?: boolean
          p_is_primary_contact?: boolean
          p_notes?: string
          p_phone?: string
          p_relationship?: string
          p_student_id: string
          p_whatsapp?: string
        }
        Returns: string
      }
      list_contracts: {
        Args: {
          p_course_id?: string
          p_date_from?: string
          p_date_to?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_seller_user_id?: string
          p_status?: string
        }
        Returns: Json
      }
      list_courses: { Args: { p_status?: string }; Returns: Json }
      list_crm_lead_activities: {
        Args: {
          p_lead_id: string
          p_page?: number
          p_page_size?: number
          p_status?: string
        }
        Returns: Json
      }
      list_crm_pipeline: {
        Args: { p_limit?: number; p_owner_user_id?: string }
        Returns: Json
      }
      list_crm_pipeline_stages: { Args: never; Returns: Json }
      list_guardians: { Args: { p_student_id: string }; Returns: Json }
      list_sales: {
        Args: {
          p_course_id?: string
          p_date_from?: string
          p_date_to?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_seller_user_id?: string
          p_status?: string
        }
        Returns: Json
      }
      mark_contract_signed: { Args: { p_contract_id: string }; Returns: Json }
      mask_cpf: { Args: { p_value: string }; Returns: string }
      mask_email: { Args: { p_value: string }; Returns: string }
      mask_phone: { Args: { p_value: string }; Returns: string }
      move_crm_lead_stage: {
        Args: { p_lead_id: string; p_new_stage_id: string; p_reason?: string }
        Returns: undefined
      }
      reschedule_crm_activity: {
        Args: { p_activity_id: string; p_new_due_at: string }
        Returns: undefined
      }
      search_contractor_people: {
        Args: { p_limit?: number; p_query?: string }
        Returns: Json
      }
      search_crm_leads: {
        Args: {
          p_course_interest_id?: string
          p_no_activity?: boolean
          p_overdue_only?: boolean
          p_owner_user_id?: string
          p_page?: number
          p_page_size?: number
          p_query?: string
          p_sort?: string
          p_sort_dir?: string
          p_source_id?: string
          p_stage_code?: string
          p_status?: string
          p_temperature?: string
        }
        Returns: Json
      }
      search_students: {
        Args: {
          p_origin?: string
          p_page?: number
          p_page_size?: number
          p_query?: string
          p_sort?: string
          p_sort_dir?: string
          p_status?: string
        }
        Returns: Json
      }
      student_kpis: { Args: never; Returns: Json }
      unlink_guardian: { Args: { p_guardian_id: string }; Returns: undefined }
      update_contract_draft: {
        Args: {
          p_contract_id: string
          p_contract_notes: string
          p_contractor_person_id: string
        }
        Returns: Json
      }
      update_course: {
        Args: {
          p_category?: string
          p_course_id: string
          p_default_price?: number
          p_description?: string
          p_duration_unit?: string
          p_duration_value?: number
          p_modality?: string
          p_name?: string
          p_short_name?: string
          p_status?: string
          p_workload_hours?: number
        }
        Returns: undefined
      }
      update_crm_lead: {
        Args: {
          p_budget_notes?: string
          p_commercial_notes?: string
          p_course_interest_id?: string
          p_decision_maker?: string
          p_estimated_value?: number
          p_lead_id: string
          p_preferred_modality?: string
          p_preferred_shift?: string
          p_proposed_value?: number
          p_qualification_start_period?: string
          p_source_detail?: string
          p_source_id?: string
          p_stage_id?: string
          p_temperature?: string
        }
        Returns: undefined
      }
      update_person: {
        Args: {
          p_birth_date?: string
          p_city?: string
          p_complement?: string
          p_district?: string
          p_email?: string
          p_emergency_contact_name?: string
          p_emergency_contact_phone?: string
          p_full_name?: string
          p_notes?: string
          p_number?: string
          p_person_id: string
          p_phone?: string
          p_postal_code?: string
          p_preferred_name?: string
          p_state?: string
          p_street?: string
          p_whatsapp?: string
        }
        Returns: Json
      }
      update_student: {
        Args: {
          p_birth_date?: string
          p_city?: string
          p_complement?: string
          p_district?: string
          p_email?: string
          p_emergency_contact_name?: string
          p_emergency_contact_phone?: string
          p_full_name: string
          p_notes?: string
          p_number?: string
          p_origin?: string
          p_phone?: string
          p_postal_code?: string
          p_preferred_name?: string
          p_state?: string
          p_street?: string
          p_student_id: string
          p_whatsapp?: string
        }
        Returns: undefined
      }
      write_audit_log: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
