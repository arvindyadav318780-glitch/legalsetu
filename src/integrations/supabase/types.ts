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
      abuse_reports: {
        Row: {
          contact_request_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          reason: string
          reason_code: string
          reporter_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          target_user_id: string
        }
        Insert: {
          contact_request_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          reason_code?: string
          reporter_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          target_user_id: string
        }
        Update: {
          contact_request_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          reason_code?: string
          reporter_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abuse_reports_contact_request_id_fkey"
            columns: ["contact_request_id"]
            isOneToOne: false
            referencedRelation: "contact_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abuse_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_restrictions: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          issued_by: string
          lift_reason: string | null
          lifted_at: string | null
          lifted_by: string | null
          reason: string
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          issued_by: string
          lift_reason?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason: string
          starts_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          issued_by?: string
          lift_reason?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          id: string
          recipients: number
          sent_by: string
          target_user: string | null
          title: string
        }
        Insert: {
          audience: string
          body: string
          created_at?: string
          id?: string
          recipients?: number
          sent_by: string
          target_user?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          id?: string
          recipients?: number
          sent_by?: string
          target_user?: string | null
          title?: string
        }
        Relationships: []
      }
      appeals: {
        Row: {
          body: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          restriction_id: string | null
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          restriction_id?: string | null
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          restriction_id?: string | null
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appeals_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "account_restrictions"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          mode: string
          preferred_at: string
          professional_id: string | null
          request_id: string | null
          status: string
          topic: string
        }
        Insert: {
          created_at?: string
          customer_id?: string
          id?: string
          mode?: string
          preferred_at: string
          professional_id?: string | null
          request_id?: string | null
          status?: string
          topic: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          mode?: string
          preferred_at?: string
          professional_id?: string | null
          request_id?: string | null
          status?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string
          body: string
          category: string
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
        }
        Insert: {
          author_name?: string
          body: string
          category: string
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
        }
        Update: {
          author_name?: string
          body?: string
          category?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          action: string
          created_at: string
          id: string
          purpose: string
          request_id: string | null
          user_id: string
          version: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          purpose: string
          request_id?: string | null
          user_id: string
          version: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          purpose?: string
          request_id?: string | null
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          handling_note: string | null
          handling_status: string
          id: string
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          handled_at?: string | null
          handled_by?: string | null
          handling_note?: string | null
          handling_status?: string
          id?: string
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          handled_at?: string | null
          handled_by?: string | null
          handling_note?: string | null
          handling_status?: string
          id?: string
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decline_reason: string | null
          id: string
          initiated_by: string
          message: string
          pair_key: string
          professional_id: string
          request_id: string | null
          status: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decline_reason?: string | null
          id?: string
          initiated_by?: string
          message: string
          pair_key?: string
          professional_id: string
          request_id?: string | null
          status?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decline_reason?: string | null
          id?: string
          initiated_by?: string
          message?: string
          pair_key?: string
          professional_id?: string
          request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_access_log: {
        Row: {
          created_at: string
          id: string
          reason: string
          request_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          request_id: string
          staff_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          request_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_access_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          client_id: string
          closed: boolean
          contact_request_id: string
          created_at: string
          id: string
          professional_id: string
        }
        Insert: {
          client_id: string
          closed?: boolean
          contact_request_id: string
          created_at?: string
          id?: string
          professional_id: string
        }
        Update: {
          client_id?: string
          closed?: boolean
          contact_request_id?: string
          created_at?: string
          id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_request_id_fkey"
            columns: ["contact_request_id"]
            isOneToOne: true
            referencedRelation: "contact_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_checks: {
        Row: {
          checked_on: string
          created_at: string
          id: string
          method: string
          notes: string | null
          outcome: string
          profession: string
          professional_id: string
          reference: string
          reviewer_id: string
        }
        Insert: {
          checked_on: string
          created_at?: string
          id?: string
          method: string
          notes?: string | null
          outcome: string
          profession: string
          professional_id: string
          reference: string
          reviewer_id: string
        }
        Update: {
          checked_on?: string
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          outcome?: string
          profession?: string
          professional_id?: string
          reference?: string
          reviewer_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          contact_request_id: string | null
          created_at: string
          created_by: string | null
          delta: number
          id: string
          kind: string
          note: string | null
          order_id: string | null
          pair_key: string | null
          price_paise: number
          professional_id: string
          refund_id: string | null
          reverses_id: string | null
        }
        Insert: {
          contact_request_id?: string | null
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          kind: string
          note?: string | null
          order_id?: string | null
          pair_key?: string | null
          price_paise?: number
          professional_id: string
          refund_id?: string | null
          reverses_id?: string | null
        }
        Update: {
          contact_request_id?: string | null
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          pair_key?: string | null
          price_paise?: number
          professional_id?: string
          refund_id?: string | null
          reverses_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_contact_request_id_fkey"
            columns: ["contact_request_id"]
            isOneToOne: false
            referencedRelation: "contact_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "credit_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_orders: {
        Row: {
          amount_paise: number
          created_at: string
          credits: number
          failure_reason: string | null
          id: string
          paid_at: string | null
          professional_id: string
          provider_order_id: string | null
          provider_payment_id: string | null
          status: string
          test_mode: boolean
        }
        Insert: {
          amount_paise: number
          created_at?: string
          credits: number
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          professional_id: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          test_mode?: boolean
        }
        Update: {
          amount_paise?: number
          created_at?: string
          credits?: number
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          professional_id?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          test_mode?: boolean
        }
        Relationships: []
      }
      credit_refunds: {
        Row: {
          amount_paise: number
          created_at: string
          credits_reversed: number
          failure_reason: string | null
          id: string
          note: string
          order_id: string
          professional_id: string
          provider_refund_id: string | null
          reviewer_id: string
          settled_at: string | null
          status: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          credits_reversed: number
          failure_reason?: string | null
          id?: string
          note: string
          order_id: string
          professional_id: string
          provider_refund_id?: string | null
          reviewer_id: string
          settled_at?: string | null
          status?: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          credits_reversed?: number
          failure_reason?: string | null
          id?: string
          note?: string
          order_id?: string
          professional_id?: string
          provider_refund_id?: string | null
          reviewer_id?: string
          settled_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "credit_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_access_log: {
        Row: {
          created_at: string
          document_id: string
          id: string
          reason: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          reason: string
          staff_id?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          reason?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_access_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          created_at: string
          fulfilled_at: string | null
          fulfilled_document_id: string | null
          id: string
          label: string
          note: string | null
          request_id: string
          requested_by: string
          status: string
        }
        Insert: {
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_document_id?: string | null
          id?: string
          label: string
          note?: string | null
          request_id: string
          requested_by: string
          status?: string
        }
        Update: {
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_document_id?: string | null
          id?: string
          label?: string
          note?: string | null
          request_id?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_fulfilled_document_id_fkey"
            columns: ["fulfilled_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          owner_id: string
          request_id: string | null
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          owner_id?: string
          request_id?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          owner_id?: string
          request_id?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          published: boolean
          question: string
          sort: number
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          published?: boolean
          question: string
          sort?: number
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          published?: boolean
          question?: string
          sort?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_paise: number
          created_at: string
          description: string
          id: string
          refund_note: string | null
          refund_recorded_at: string | null
          refund_recorded_by: string | null
          status: string
          test_mode: boolean
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          description: string
          id?: string
          refund_note?: string | null
          refund_recorded_at?: string | null
          refund_recorded_by?: string | null
          status?: string
          test_mode?: boolean
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          description?: string
          id?: string
          refund_note?: string | null
          refund_recorded_at?: string | null
          refund_recorded_by?: string | null
          status?: string
          test_mode?: boolean
          user_id?: string
        }
        Relationships: []
      }
      marketplace_settings: {
        Row: {
          contact_price_paise: number
          credits_enabled_advocate: boolean
          credits_enabled_ca: boolean
          id: number
          legal_review_completed_at: string | null
          legal_review_note: string | null
          pro_initiate_advocate: boolean
          pro_initiate_ca: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact_price_paise?: number
          credits_enabled_advocate?: boolean
          credits_enabled_ca?: boolean
          id?: number
          legal_review_completed_at?: string | null
          legal_review_note?: string | null
          pro_initiate_advocate?: boolean
          pro_initiate_ca?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact_price_paise?: number
          credits_enabled_advocate?: boolean
          credits_enabled_ca?: boolean
          id?: number
          legal_review_completed_at?: string | null
          legal_review_note?: string | null
          pro_initiate_advocate?: boolean
          pro_initiate_ca?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          request_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          request_id: string
          sender_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          event_type: string
          id: string
          outcome: string | null
          payment_id: string | null
          provider_event_id: string
          received_at: string
        }
        Insert: {
          event_type: string
          id?: string
          outcome?: string | null
          payment_id?: string | null
          provider_event_id: string
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          outcome?: string | null
          payment_id?: string | null
          provider_event_id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_confirmed_at: string | null
          created_at: string
          created_by: string
          customer_id: string
          description: string
          failure_reason: string | null
          government_fee_paise: number
          id: string
          invoice_number: string | null
          paid_at: string | null
          platform_fee_paise: number
          platform_tax_paise: number
          professional_fee_paise: number
          professional_id: string | null
          professional_tax_paise: number
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          refunded_paise: number
          request_id: string
          status: string
          tax_note: string | null
          test_mode: boolean
          total_paise: number
          updated_at: string
        }
        Insert: {
          amount_confirmed_at?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          description: string
          failure_reason?: string | null
          government_fee_paise?: number
          id?: string
          invoice_number?: string | null
          paid_at?: string | null
          platform_fee_paise?: number
          platform_tax_paise?: number
          professional_fee_paise?: number
          professional_id?: string | null
          professional_tax_paise?: number
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          refunded_paise?: number
          request_id: string
          status?: string
          tax_note?: string | null
          test_mode?: boolean
          total_paise: number
          updated_at?: string
        }
        Update: {
          amount_confirmed_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string
          failure_reason?: string | null
          government_fee_paise?: number
          id?: string
          invoice_number?: string | null
          paid_at?: string | null
          platform_fee_paise?: number
          platform_tax_paise?: number
          professional_fee_paise?: number
          professional_id?: string | null
          professional_tax_paise?: number
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          refunded_paise?: number
          request_id?: string
          status?: string
          tax_note?: string | null
          test_mode?: boolean
          total_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          fee_paise: number | null
          note: string | null
          service_slug: string
          updated_at: string
        }
        Insert: {
          fee_paise?: number | null
          note?: string | null
          service_slug: string
          updated_at?: string
        }
        Update: {
          fee_paise?: number | null
          note?: string | null
          service_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      professional_profiles: {
        Row: {
          availability: string | null
          category: string
          city: string | null
          consultation_modes: string[] | null
          cop_number: string | null
          created_at: string
          description: string | null
          display_name: string
          expertise: string[] | null
          fee_from_paise: number | null
          fee_to_paise: number | null
          is_listed: boolean
          languages: string[] | null
          membership_number: string | null
          photo_path: string | null
          qualifications: string | null
          registration_details: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          suspended: boolean
          updated_at: string
          user_id: string
          verification_note: string | null
          verification_status: string
          years_experience: number | null
        }
        Insert: {
          availability?: string | null
          category: string
          city?: string | null
          consultation_modes?: string[] | null
          cop_number?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          expertise?: string[] | null
          fee_from_paise?: number | null
          fee_to_paise?: number | null
          is_listed?: boolean
          languages?: string[] | null
          membership_number?: string | null
          photo_path?: string | null
          qualifications?: string | null
          registration_details?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          suspended?: boolean
          updated_at?: string
          user_id: string
          verification_note?: string | null
          verification_status?: string
          years_experience?: number | null
        }
        Update: {
          availability?: string | null
          category?: string
          city?: string | null
          consultation_modes?: string[] | null
          cop_number?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          expertise?: string[] | null
          fee_from_paise?: number | null
          fee_to_paise?: number | null
          is_listed?: boolean
          languages?: string[] | null
          membership_number?: string | null
          photo_path?: string | null
          qualifications?: string | null
          registration_details?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          suspended?: boolean
          updated_at?: string
          user_id?: string
          verification_note?: string | null
          verification_status?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          notify_email: boolean | null
          phone: string | null
          preferred_language: string | null
          state: string | null
          suspended: boolean
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          notify_email?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          state?: string | null
          suspended?: boolean
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notify_email?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          state?: string | null
          suspended?: boolean
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          amount_paise: number
          created_at: string
          customer_id: string
          id: string
          payment_id: string
          provider_refund_id: string | null
          reason: string
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          customer_id: string
          id?: string
          payment_id: string
          provider_refund_id?: string | null
          reason: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          customer_id?: string
          id?: string
          payment_id?: string
          provider_refund_id?: string | null
          reason?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          request_id: string
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id: string
          status: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_settings: {
        Row: {
          backup_note: string | null
          closed_contact_retention_days: number
          id: number
          last_purge_at: string | null
          message_retention_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          backup_note?: string | null
          closed_contact_retention_days?: number
          id?: number
          last_purge_at?: string | null
          message_retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          backup_note?: string | null
          closed_contact_retention_days?: number
          id?: number
          last_purge_at?: string | null
          message_retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          client_id: string
          conversation_id: string | null
          created_at: string
          id: string
          moderation_note: string | null
          professional_id: string
          rating: number
          request_id: string | null
          status: string
        }
        Insert: {
          body?: string | null
          client_id: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          moderation_note?: string | null
          professional_id: string
          rating: number
          request_id?: string | null
          status?: string
        }
        Update: {
          body?: string | null
          client_id?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          moderation_note?: string | null
          professional_id?: string
          rating?: number
          request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_alerts: {
        Row: {
          created_at: string
          details: Json
          id: string
          kind: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          kind: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      saved_professionals: {
        Row: {
          created_at: string
          professional_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          professional_key: string
          user_id?: string
        }
        Update: {
          created_at?: string
          professional_key?: string
          user_id?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          area: string | null
          created_at: string
          id: string
          is_test: boolean
          kind: string
          severity: string
          summary: string
          user_id: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          kind: string
          severity?: string
          summary: string
          user_id?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          kind?: string
          severity?: string
          summary?: string
          user_id?: string | null
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          blurb: string | null
          key: string
          name: string
          sort: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          blurb?: string | null
          key: string
          name: string
          sort?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          blurb?: string | null
          key?: string
          name?: string
          sort?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          answers: Json
          assigned_professional_id: string | null
          assignment_accepted_at: string | null
          assignment_note: string | null
          city: string | null
          contact_consent_at: string | null
          contact_consent_withdrawn_at: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          contact_preference: string | null
          created_at: string
          customer_id: string
          details: string | null
          id: string
          mode: string | null
          next_action: string | null
          reference: string
          service_name: string
          service_slug: string
          state: string | null
          status: Database["public"]["Enums"]["request_status"]
          terms_accepted: boolean
          updated_at: string
          urgency: string | null
        }
        Insert: {
          answers?: Json
          assigned_professional_id?: string | null
          assignment_accepted_at?: string | null
          assignment_note?: string | null
          city?: string | null
          contact_consent_at?: string | null
          contact_consent_withdrawn_at?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          contact_preference?: string | null
          created_at?: string
          customer_id?: string
          details?: string | null
          id?: string
          mode?: string | null
          next_action?: string | null
          reference?: string
          service_name: string
          service_slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          terms_accepted?: boolean
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          answers?: Json
          assigned_professional_id?: string | null
          assignment_accepted_at?: string | null
          assignment_note?: string | null
          city?: string | null
          contact_consent_at?: string | null
          contact_consent_withdrawn_at?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          contact_preference?: string | null
          created_at?: string
          customer_id?: string
          details?: string | null
          id?: string
          mode?: string | null
          next_action?: string | null
          reference?: string
          service_name?: string
          service_slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          terms_accepted?: boolean
          updated_at?: string
          urgency?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string
          documents: string[]
          modes: string[]
          name: string
          overview: string | null
          popular: boolean
          professional: string | null
          short: string | null
          slug: string
          sort: number
          updated_at: string
          visible: boolean
          who_needs: string[]
          workflow: string[]
        }
        Insert: {
          category: string
          documents?: string[]
          modes?: string[]
          name: string
          overview?: string | null
          popular?: boolean
          professional?: string | null
          short?: string | null
          slug: string
          sort?: number
          updated_at?: string
          visible?: boolean
          who_needs?: string[]
          workflow?: string[]
        }
        Update: {
          category?: string
          documents?: string[]
          modes?: string[]
          name?: string
          overview?: string | null
          popular?: boolean
          professional?: string | null
          short?: string | null
          slug?: string
          sort?: number
          updated_at?: string
          visible?: boolean
          who_needs?: string[]
          workflow?: string[]
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          body: string
          created_at: string
          id: string
          kind: string
          request_id: string | null
          resolution_note: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          body: string
          created_at?: string
          id?: string
          kind?: string
          request_id?: string | null
          resolution_note?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          assigned_to?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          request_id?: string | null
          resolution_note?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_staff: boolean
          ticket_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
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
      verification_reviews: {
        Row: {
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          professional_id: string
          reviewer_id: string | null
          to_status: string
        }
        Insert: {
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          professional_id: string
          reviewer_id?: string | null
          to_status: string
        }
        Update: {
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          professional_id?: string
          reviewer_id?: string | null
          to_status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_contact_request: { Args: { _id: string }; Returns: string }
      admin_adjust_credits: {
        Args: { _delta: number; _pro: string; _reason: string }
        Returns: string
      }
      admin_lift_restriction: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      admin_restrict_account: {
        Args: {
          _hours: number
          _reason: string
          _starts_at?: string
          _uid: string
        }
        Returns: string
      }
      admin_reverse_credit: {
        Args: { _ledger_id: string; _note: string }
        Returns: string
      }
      assigned_professional_name: { Args: { _rid: string }; Returns: string }
      can_access_request: { Args: { _rid: string }; Returns: boolean }
      can_read_conversation: { Args: { _rid: string }; Returns: boolean }
      contact_shareable: { Args: { _rid: string }; Returns: boolean }
      credit_balance: { Args: { _uid: string }; Returns: number }
      credits_required_for: { Args: { _pro: string }; Returns: boolean }
      crm_ack_alert: {
        Args: { _id: string; _note: string }
        Returns: undefined
      }
      crm_client_detail: { Args: { _uid: string }; Returns: Json }
      crm_dashboard: { Args: never; Returns: Json }
      crm_finance_summary: { Args: never; Returns: Json }
      crm_is_test_request: {
        Args: { _name: string; _ref: string }
        Returns: boolean
      }
      crm_overdue_days: { Args: never; Returns: number }
      crm_pro_detail: { Args: { _uid: string }; Returns: Json }
      crm_refresh_alerts: { Args: never; Returns: number }
      crm_set_overdue_days: { Args: { _days: number }; Returns: undefined }
      decline_contact_request: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      grant_order_credits: { Args: { _order_id: string }; Returns: boolean }
      has_active_restriction: { Args: { _uid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assignable_pro: { Args: { _uid: string }; Returns: boolean }
      is_blocked_pair: { Args: { _a: string; _b: string }; Returns: boolean }
      is_conversation_party: { Args: { _cid: string }; Returns: boolean }
      is_professional: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_suspended: { Args: { _user_id: string }; Returns: boolean }
      log_security_event: {
        Args: { _area: string; _kind: string; _summary: string }
        Returns: undefined
      }
      next_invoice_number: { Args: never; Returns: string }
      oversight_eligible: { Args: { _rid: string }; Returns: boolean }
      pro_lead_summaries: {
        Args: never
        Returns: {
          city: string
          contact_request_id: string
          service_name: string
          urgency: string
        }[]
      }
      pro_public_stats: {
        Args: { _pro: string }
        Returns: {
          avg_rating: number
          interaction_count: number
          review_count: number
        }[]
      }
      purge_expired: { Args: { _confirm: string }; Returns: Json }
      raise_alert: {
        Args: { _details: Json; _kind: string; _uid: string }
        Returns: undefined
      }
      record_credential_check: {
        Args: {
          _checked_on: string
          _method: string
          _notes?: string
          _outcome: string
          _pro: string
          _reference: string
        }
        Returns: string
      }
      reports_about_me: {
        Args: never
        Returns: {
          open_count: number
          total_count: number
        }[]
      }
      request_contact: {
        Args: { _rid: string }
        Returns: {
          contact_email: string
          contact_phone: string
          shared: boolean
        }[]
      }
      request_signature: {
        Args: { _answers: Json; _details: string }
        Returns: string
      }
      retention_preview: {
        Args: never
        Returns: {
          old_closed_contacts: number
          old_messages: number
        }[]
      }
      set_contact_consent: {
        Args: { _grant: boolean; _rid: string }
        Returns: undefined
      }
      settle_credit_refund: {
        Args: {
          _provider_refund_id: string
          _reason: string
          _refund: string
          _status: string
        }
        Returns: boolean
      }
      staff_can_read_conversation: { Args: { _cid: string }; Returns: boolean }
      staff_contact_messages: {
        Args: never
        Returns: {
          created_at: string
          email: string
          handled_at: string
          handling_note: string
          handling_status: string
          id: string
          message: string
          name: string
          subject: string
        }[]
      }
      staff_directory: {
        Args: never
        Returns: {
          city: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_customer: boolean
          state: string
          suspended: boolean
          suspended_reason: string
        }[]
      }
      staff_doc_unlocked: { Args: { _path: string }; Returns: boolean }
      start_credit_refund: {
        Args: { _note: string; _order: string }
        Returns: string
      }
      update_contact_message: {
        Args: { _id: string; _note: string; _status: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "customer"
        | "ca"
        | "advocate"
        | "professional"
        | "support"
        | "admin"
      request_status:
        | "submitted"
        | "under_review"
        | "awaiting_documents"
        | "professional_review"
        | "quote_provided"
        | "awaiting_confirmation"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
        | "professional_assigned"
        | "customer_action_required"
        | "closed"
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
      app_role: [
        "customer",
        "ca",
        "advocate",
        "professional",
        "support",
        "admin",
      ],
      request_status: [
        "submitted",
        "under_review",
        "awaiting_documents",
        "professional_review",
        "quote_provided",
        "awaiting_confirmation",
        "in_progress",
        "completed",
        "cancelled",
        "disputed",
        "professional_assigned",
        "customer_action_required",
        "closed",
      ],
    },
  },
} as const
