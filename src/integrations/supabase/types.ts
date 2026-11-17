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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          created_by: string | null
          disabled_reason: string | null
          failed_logins: number
          kind: string
          last_login_at: string | null
          mfa_required: boolean
          must_change_password: boolean
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          disabled_reason?: string | null
          failed_logins?: number
          kind?: string
          last_login_at?: string | null
          mfa_required?: boolean
          must_change_password?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          disabled_reason?: string | null
          failed_logins?: number
          kind?: string
          last_login_at?: string | null
          mfa_required?: boolean
          must_change_password?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_request_log: {
        Row: {
          at: string
          credential_id: string | null
          endpoint: string
          id: number
          ip: string | null
          ms: number | null
          status: number
        }
        Insert: {
          at?: string
          credential_id?: string | null
          endpoint: string
          id?: never
          ip?: string | null
          ms?: number | null
          status: number
        }
        Update: {
          at?: string
          credential_id?: string | null
          endpoint?: string
          id?: never
          ip?: string | null
          ms?: number | null
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_request_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "system_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_type: string
          after: Json | null
          before: Json | null
          created_at: string
          details: Json | null
          hash: string | null
          id: string
          ip: string | null
          prev_hash: string | null
          reason: string | null
          seq: number | null
          system_id: string | null
          target: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          details?: Json | null
          hash?: string | null
          id?: string
          ip?: string | null
          prev_hash?: string | null
          reason?: string | null
          seq?: number | null
          system_id?: string | null
          target?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          details?: Json | null
          hash?: string | null
          id?: string
          ip?: string | null
          prev_hash?: string | null
          reason?: string | null
          seq?: number | null
          system_id?: string | null
          target?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_initialization: {
        Row: {
          claim_token: string | null
          claimed_at: string | null
          completed_at: string | null
          singleton: boolean
        }
        Insert: {
          claim_token?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          singleton?: boolean
        }
        Update: {
          claim_token?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          singleton?: boolean
        }
        Relationships: []
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      outbound_events: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          status: string
          system_id: string
          type: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
          system_id: string
          type: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
          system_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_events_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_versions: {
        Row: {
          changed_at: string
          system_id: string
          user_id: string
          version: number
        }
        Insert: {
          changed_at?: string
          system_id: string
          user_id: string
          version?: number
        }
        Update: {
          changed_at?: string
          system_id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "permission_versions_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_versions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_site_id: string | null
          department_id: string | null
          email: string
          employee_no: string | null
          full_name: string | null
          id: string
          is_active: boolean
          job_title: string | null
          locale: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_site_id?: string | null
          department_id?: string | null
          email: string
          employee_no?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          locale?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_site_id?: string | null
          department_id?: string | null
          email?: string
          employee_no?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          locale?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_site_id_fkey"
            columns: ["default_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_actions: {
        Row: {
          action_id: string
          created_at: string
          resource_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          resource_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_actions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_actions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_sensitive: boolean
          key: string
          kind: string
          module: string
          module_id: string | null
          name: string
          parent_id: string | null
          route_path: string | null
          sort_order: number
          status: string
          system_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_sensitive?: boolean
          key: string
          kind: string
          module?: string
          module_id?: string | null
          name: string
          parent_id?: string | null
          route_path?: string | null
          sort_order?: number
          status?: string
          system_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_sensitive?: boolean
          key?: string
          kind?: string
          module?: string
          module_id?: string | null
          name?: string
          parent_id?: string | null
          route_path?: string | null
          sort_order?: number
          status?: string
          system_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "system_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      role_action_grants: {
        Row: {
          action_id: string
          created_at: string
          created_by: string | null
          effect: string
          resource_id: string
          role_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          created_by?: string | null
          effect?: string
          resource_id: string
          role_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          created_by?: string | null
          effect?: string
          resource_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_action_grants_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_action_grants_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_action_grants_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          granted_by: string | null
          id: string
          reason: string | null
          role_id: string
          site_id: string | null
          subject_id: string
          subject_type: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          role_id: string
          site_id?: string | null
          subject_id: string
          subject_type: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          role_id?: string
          site_id?: string | null
          subject_id?: string
          subject_type?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      role_composites: {
        Row: {
          child_role_id: string
          created_at: string
          created_by: string | null
          parent_role_id: string
        }
        Insert: {
          child_role_id: string
          created_at?: string
          created_by?: string | null
          parent_role_id: string
        }
        Update: {
          child_role_id?: string
          created_at?: string
          created_by?: string | null
          parent_role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_composites_child_role_id_fkey"
            columns: ["child_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_composites_parent_role_id_fkey"
            columns: ["parent_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          resource_id: string
          role_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          resource_id: string
          role_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          resource_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
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
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_locked: boolean
          is_template: boolean
          key: string | null
          max_session_minutes: number | null
          mfa_required: boolean
          name: string
          priority: number
          system_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_locked?: boolean
          is_template?: boolean
          key?: string | null
          max_session_minutes?: number | null
          mfa_required?: boolean
          name: string
          priority?: number
          system_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_locked?: boolean
          is_template?: boolean
          key?: string | null
          max_session_minutes?: number | null
          mfa_required?: boolean
          name?: string
          priority?: number
          system_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          org_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_credentials: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          last_used_at: string | null
          last_used_ip: string | null
          prefix: string
          rate_limit_per_min: number
          revoked_by: string | null
          revoked_reason: string | null
          salt: string
          scopes: string[]
          secret_hash: string
          status: string
          system_id: string
          type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          prefix: string
          rate_limit_per_min?: number
          revoked_by?: string | null
          revoked_reason?: string | null
          salt: string
          scopes?: string[]
          secret_hash: string
          status?: string
          system_id: string
          type: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          prefix?: string
          rate_limit_per_min?: number
          revoked_by?: string | null
          revoked_reason?: string | null
          salt?: string
          scopes?: string[]
          secret_hash?: string
          status?: string
          system_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_credentials_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      system_modules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key: string
          name: string
          sort_order: number
          system_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          name: string
          sort_order?: number
          system_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          name?: string
          sort_order?: number
          system_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_modules_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      systems: {
        Row: {
          api_key: string | null
          base_url: string | null
          code: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          key: string
          login_callback_urls: string[]
          logout_url: string | null
          module_type: string | null
          name: string
          owner_user_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["system_status"]
          updated_at: string
          url: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          login_callback_urls?: string[]
          logout_url?: string | null
          module_type?: string | null
          name: string
          owner_user_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["system_status"]
          updated_at?: string
          url?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          login_callback_urls?: string[]
          logout_url?: string | null
          module_type?: string | null
          name?: string
          owner_user_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["system_status"]
          updated_at?: string
          url?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "systems_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_members: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          action_id: string
          created_at: string
          created_by: string | null
          effect: string
          granted_by: string | null
          id: string
          reason: string
          resource_id: string
          site_id: string | null
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          action_id: string
          created_at?: string
          created_by?: string | null
          effect: string
          granted_by?: string | null
          id?: string
          reason: string
          resource_id: string
          site_id?: string | null
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          action_id?: string
          created_at?: string
          created_by?: string | null
          effect?: string
          granted_by?: string | null
          id?: string
          reason?: string
          resource_id?: string
          site_id?: string | null
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_system_access: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          local_username: string | null
          provision_error: string | null
          provision_status: string
          provisioned_at: string | null
          system_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          local_username?: string | null
          provision_error?: string | null
          provision_status?: string
          provisioned_at?: string | null
          system_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          local_username?: string | null
          provision_error?: string | null
          provision_status?: string
          provisioned_at?: string | null
          system_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_system_access_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_system_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_system_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_system_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_system_roles_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ams_account_active: { Args: { _uid: string }; Returns: boolean }
      ams_active_super_admins: { Args: never; Returns: number }
      ams_actor_holds: {
        Args: { _action: string; _resource: string; _uid: string }
        Returns: boolean
      }
      ams_bump: {
        Args: { _event: string; _system: string; _uid: string }
        Returns: undefined
      }
      ams_can_manage_user: {
        Args: { _actor: string; _perm: string; _target: string }
        Returns: boolean
      }
      ams_check: {
        Args: { _permission_key: string; _site_id?: string; _user_id: string }
        Returns: boolean
      }
      ams_create_credential: {
        Args: {
          _expires_at: string
          _overlap_days?: number
          _rotate_from?: string
          _scopes: string[]
          _system: string
          _type: string
        }
        Returns: {
          client_id: string
          credential_id: string
          secret: string
        }[]
      }
      ams_effective_core: {
        Args: { _site?: string; _system: string; _uid: string }
        Returns: {
          action_key: string
          parent_key: string
          permission_key: string
          resource_id: string
          resource_key: string
          resource_kind: string
          route_path: string
          source: string
        }[]
      }
      ams_effective_permissions: {
        Args: { _site_id?: string; _system_code: string; _user_id: string }
        Returns: {
          action_key: string
          permission_key: string
          resource_key: string
          route_path: string
          source: string
        }[]
      }
      ams_has: { Args: { _perm: string; _uid: string }; Returns: boolean }
      ams_hash_secret: {
        Args: { _salt: string; _secret: string }
        Returns: string
      }
      ams_holds_admin_role: { Args: { _uid: string }; Returns: boolean }
      ams_is_super_admin: { Args: { _uid: string }; Returns: boolean }
      ams_my_permissions: { Args: never; Returns: string[] }
      ams_reassign_and_delete_role: {
        Args: { _reassign_to: string; _role: string }
        Returns: undefined
      }
      ams_revoke_credential: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      ams_role_holders: { Args: { _role: string }; Returns: string[] }
      ams_selftest: {
        Args: never
        Returns: {
          detail: string
          passed: boolean
          test: string
        }[]
      }
      ams_verify_audit_chain: {
        Args: never
        Returns: {
          checked: number
          first_bad_seq: number
          ok: boolean
        }[]
      }
      ams_verify_credential: {
        Args: {
          _client_id: string
          _endpoint: string
          _ip: string
          _scope: string
          _secret: string
        }
        Returns: {
          credential_id: string
          status: number
          system_code: string
          system_id: string
          system_key: string
        }[]
      }
      claim_hub_setup: { Args: { _token: string }; Returns: boolean }
      effective_permissions: {
        Args: { _system_key: string; _user_id: string }
        Returns: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          kind: string
          module: string
          name: string
          resource_key: string
        }[]
      }
      finalize_hub_setup: {
        Args: { _token: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hub_setup_available: { Args: never; Returns: boolean }
      is_hub_admin: { Args: { _user_id: string }; Returns: boolean }
      release_hub_setup: { Args: { _token: string }; Returns: undefined }
    }
    Enums: {
      account_status: "invited" | "active" | "suspended" | "locked" | "disabled"
      app_role: "super_admin" | "admin"
      system_status: "draft" | "active" | "maintenance" | "retired"
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
  public: {
    Enums: {
      account_status: ["invited", "active", "suspended", "locked", "disabled"],
      app_role: ["super_admin", "admin"],
      system_status: ["draft", "active", "maintenance", "retired"],
    },
  },
} as const
