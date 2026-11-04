
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"ai_credit_ledger": {
                  Row: {
                    "bucket": string,"created_at": string,"delta": number,"id": string,"kind": Database["public"]['Enums']["ai_kind"],"reason": string | null,"ref": string | null,"status": Database["public"]['Enums']["credit_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"created_at"?: string,"delta": number,"id"?: string,"kind": Database["public"]['Enums']["ai_kind"],"reason"?: string | null,"ref"?: string | null,"status"?: Database["public"]['Enums']["credit_status"],"user_id": string
                  }
                  Update: {
                    "bucket"?: string,"created_at"?: string,"delta"?: number,"id"?: string,"kind"?: Database["public"]['Enums']["ai_kind"],"reason"?: string | null,"ref"?: string | null,"status"?: Database["public"]['Enums']["credit_status"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_jobs": {
                  Row: {
                    "attempts": number,"batch_id": string,"created_at": string,"error": string | null,"id": string,"kind": string,"result": Json | null,"status": Database["public"]['Enums']["job_status"],"temp_path": string | null,"updated_at": string,"user_id": string,"want_studio": boolean,"wardrobe_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"batch_id": string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind"?: string,"result"?: Json | null,"status"?: Database["public"]['Enums']["job_status"],"temp_path"?: string | null,"updated_at"?: string,"user_id": string,"want_studio"?: boolean,"wardrobe_profile_id": string
                  }
                  Update: {
                    "attempts"?: number,"batch_id"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind"?: string,"result"?: Json | null,"status"?: Database["public"]['Enums']["job_status"],"temp_path"?: string | null,"updated_at"?: string,"user_id"?: string,"want_studio"?: boolean,"wardrobe_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_jobs_wardrobe_profile_id_fkey"
      columns: ["wardrobe_profile_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_conversations": {
                  Row: {
                    "created_at": string,"id": string,"title": string,"updated_at": string,"user_id": string,"wardrobe_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id": string,"wardrobe_profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string,"wardrobe_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_conversations_wardrobe_profile_id_fkey"
      columns: ["wardrobe_profile_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"looks": Json | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"looks"?: Json | null,"role": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"looks"?: Json | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "chat_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"clothing_images": {
                  Row: {
                    "bucket": string,"checks": Json | null,"created_at": string,"height": number | null,"id": string,"item_id": string,"kind": Database["public"]['Enums']["image_kind"],"model": string | null,"path": string,"user_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"checks"?: Json | null,"created_at"?: string,"height"?: number | null,"id"?: string,"item_id": string,"kind": Database["public"]['Enums']["image_kind"],"model"?: string | null,"path": string,"user_id": string,"width"?: number | null
                  }
                  Update: {
                    "bucket"?: string,"checks"?: Json | null,"created_at"?: string,"height"?: number | null,"id"?: string,"item_id"?: string,"kind"?: Database["public"]['Enums']["image_kind"],"model"?: string | null,"path"?: string,"user_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clothing_images_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "clothing_items"
      referencedColumns: ["id"]
    }
                  ]
                },"clothing_items": {
                  Row: {
                    "ai_meta": NonNullable<Json>,"brand": string | null,"category": string,"color": string | null,"color2": string | null,"created_at": string,"description": string | null,"favourite": boolean,"fingerprint": string | null,"formality": number,"id": string,"keywords": (string)[],"last_worn_on": string | null,"laundry": Database["public"]['Enums']["laundry_status"],"location_id": string | null,"material": string | null,"name": string,"needs_review": boolean,"occasions": (string)[],"pattern": string,"photo_mode": string,"purchase_date": string | null,"purchase_price": number | null,"sample": boolean,"search": unknown,"seasons": (string)[],"style_tags": (string)[],"subcategory": string,"updated_at": string,"user_id": string,"wardrobe_profile_id": string,"warmth": number,"wear_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_meta"?: NonNullable<Json>,"brand"?: string | null,"category": string,"color"?: string | null,"color2"?: string | null,"created_at"?: string,"description"?: string | null,"favourite"?: boolean,"fingerprint"?: string | null,"formality"?: number,"id"?: string,"keywords"?: (string)[],"last_worn_on"?: string | null,"laundry"?: Database["public"]['Enums']["laundry_status"],"location_id"?: string | null,"material"?: string | null,"name": string,"needs_review"?: boolean,"occasions"?: (string)[],"pattern"?: string,"photo_mode"?: string,"purchase_date"?: string | null,"purchase_price"?: number | null,"sample"?: boolean,"search"?: unknown,"seasons"?: (string)[],"style_tags"?: (string)[],"subcategory": string,"updated_at"?: string,"user_id": string,"wardrobe_profile_id": string,"warmth"?: number,"wear_count"?: number
                  }
                  Update: {
                    "ai_meta"?: NonNullable<Json>,"brand"?: string | null,"category"?: string,"color"?: string | null,"color2"?: string | null,"created_at"?: string,"description"?: string | null,"favourite"?: boolean,"fingerprint"?: string | null,"formality"?: number,"id"?: string,"keywords"?: (string)[],"last_worn_on"?: string | null,"laundry"?: Database["public"]['Enums']["laundry_status"],"location_id"?: string | null,"material"?: string | null,"name"?: string,"needs_review"?: boolean,"occasions"?: (string)[],"pattern"?: string,"photo_mode"?: string,"purchase_date"?: string | null,"purchase_price"?: number | null,"sample"?: boolean,"search"?: unknown,"seasons"?: (string)[],"style_tags"?: (string)[],"subcategory"?: string,"updated_at"?: string,"user_id"?: string,"wardrobe_profile_id"?: string,"warmth"?: number,"wear_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "clothing_items_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "clothing_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clothing_items_wardrobe_profile_id_fkey"
      columns: ["wardrobe_profile_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clothing_locations": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"name": string,"parent_id": string | null,"sort": number,"user_id": string,"wardrobe_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"name": string,"parent_id"?: string | null,"sort"?: number,"user_id": string,"wardrobe_profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"name"?: string,"parent_id"?: string | null,"sort"?: number,"user_id"?: string,"wardrobe_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clothing_locations_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "clothing_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clothing_locations_wardrobe_profile_id_fkey"
      columns: ["wardrobe_profile_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_packs": {
                  Row: {
                    "active": boolean,"id": string,"name": string,"price_inr": number,"studio_credits": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"id": string,"name": string,"price_inr": number,"studio_credits": number
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"name"?: string,"price_inr"?: number,"studio_credits"?: number
                  }
                  Relationships: [
                    
                  ]
                },"feedback": {
                  Row: {
                    "context": Json | null,"created_at": string,"id": string,"message": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: Json | null,"created_at"?: string,"id"?: string,"message": string,"user_id"?: string | null
                  }
                  Update: {
                    "context"?: Json | null,"created_at"?: string,"id"?: string,"message"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"outfit_calendar": {
                  Row: {
                    "date": string,"id": string,"note": string | null,"outfit_id": string,"user_id": string,"wardrobe_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "date": string,"id"?: string,"note"?: string | null,"outfit_id": string,"user_id": string,"wardrobe_profile_id": string
                  }
                  Update: {
                    "date"?: string,"id"?: string,"note"?: string | null,"outfit_id"?: string,"user_id"?: string,"wardrobe_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outfit_calendar_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfit_combinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outfit_calendar_wardrobe_profile_id_fkey"
      columns: ["wardrobe_profile_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"outfit_combinations": {
                  Row: {
                    "created_at": string,"favourite": boolean,"id": string,"occasion": string | null,"source": string,"tips": string | null,"title": string | null,"user_id": string,"wardrobe_profile_id": string,"why": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"favourite"?: boolean,"id"?: string,"occasion"?: string | null,"source"?: string,"tips"?: string | null,"title"?: string | null,"user_id": string,"wardrobe_profile_id": string,"why"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"favourite"?: boolean,"id"?: string,"occasion"?: string | null,"source"?: string,"tips"?: string | null,"title"?: string | null,"user_id"?: string,"wardrobe_profile_id"?: string,"why"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "outfit_combinations_wardrobe_profile_id_fkey"
      columns: ["wardrobe_profile_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"outfit_items": {
                  Row: {
                    "item_id": string,"outfit_id": string,"slot": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "item_id": string,"outfit_id": string,"slot"?: string | null,"user_id": string
                  }
                  Update: {
                    "item_id"?: string,"outfit_id"?: string,"slot"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outfit_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "clothing_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outfit_items_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfit_combinations"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"created_at": string,"currency": string,"description": string | null,"error": string | null,"id": string,"kind": string,"pack_id": string | null,"razorpay_order_id": string | null,"razorpay_payment_id": string | null,"razorpay_subscription_id": string | null,"status": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at"?: string,"currency"?: string,"description"?: string | null,"error"?: string | null,"id"?: string,"kind": string,"pack_id"?: string | null,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"razorpay_subscription_id"?: string | null,"status": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"currency"?: string,"description"?: string | null,"error"?: string | null,"id"?: string,"kind"?: string,"pack_id"?: string | null,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"razorpay_subscription_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_pack_id_fkey"
      columns: ["pack_id"]
isOneToOne: false
      referencedRelation: "credit_packs"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "active": boolean,"features": NonNullable<Json>,"id": string,"limits": NonNullable<Json>,"name": string,"price_annual_inr": number,"price_monthly_inr": number,"razorpay_plan_annual": string | null,"razorpay_plan_monthly": string | null,"sort": number,"tagline": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"features"?: NonNullable<Json>,"id": string,"limits": NonNullable<Json>,"name": string,"price_annual_inr"?: number,"price_monthly_inr"?: number,"razorpay_plan_annual"?: string | null,"razorpay_plan_monthly"?: string | null,"sort"?: number,"tagline"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"features"?: NonNullable<Json>,"id"?: string,"limits"?: NonNullable<Json>,"name"?: string,"price_annual_inr"?: number,"price_monthly_inr"?: number,"razorpay_plan_annual"?: string | null,"razorpay_plan_monthly"?: string | null,"sort"?: number,"tagline"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "active_wardrobe_id": string | null,"avatar_url": string | null,"city": string | null,"created_at": string,"display_name": string | null,"email": string | null,"id": string,"lat": number | null,"lon": number | null,"notify": NonNullable<Json>,"onboarding": NonNullable<Json>,"preferences": NonNullable<Json>,"tour_done": boolean,"units": string,"updated_at": string,"use_device_location": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active_wardrobe_id"?: string | null,"avatar_url"?: string | null,"city"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id": string,"lat"?: number | null,"lon"?: number | null,"notify"?: NonNullable<Json>,"onboarding"?: NonNullable<Json>,"preferences"?: NonNullable<Json>,"tour_done"?: boolean,"units"?: string,"updated_at"?: string,"use_device_location"?: boolean
                  }
                  Update: {
                    "active_wardrobe_id"?: string | null,"avatar_url"?: string | null,"city"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id"?: string,"lat"?: number | null,"lon"?: number | null,"notify"?: NonNullable<Json>,"onboarding"?: NonNullable<Json>,"preferences"?: NonNullable<Json>,"tour_done"?: boolean,"units"?: string,"updated_at"?: string,"use_device_location"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_active_wardrobe_fk"
      columns: ["active_wardrobe_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_wishlist": {
                  Row: {
                    "created_at": string,"id": string,"image_path": string | null,"name": string,"note": string | null,"price": number | null,"result": Json | null,"url": string | null,"user_id": string,"verdict": string | null,"wardrobe_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_path"?: string | null,"name": string,"note"?: string | null,"price"?: number | null,"result"?: Json | null,"url"?: string | null,"user_id": string,"verdict"?: string | null,"wardrobe_profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_path"?: string | null,"name"?: string,"note"?: string | null,"price"?: number | null,"result"?: Json | null,"url"?: string | null,"user_id"?: string,"verdict"?: string | null,"wardrobe_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_wishlist_wardrobe_profile_id_fkey"
      columns: ["wardrobe_profile_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "billing_interval": string,"cancel_at_period_end": boolean,"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"id": string,"plan_id": string,"razorpay_subscription_id": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_interval": string,"cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_id": string,"razorpay_subscription_id"?: string | null,"status": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "billing_interval"?: string,"cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_id"?: string,"razorpay_subscription_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_outfits": {
                  Row: {
                    "day": string,"outfit_id": string,"slot": string,"trip_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"outfit_id": string,"slot"?: string,"trip_id": string,"user_id": string
                  }
                  Update: {
                    "day"?: string,"outfit_id"?: string,"slot"?: string,"trip_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_outfits_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfit_combinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_outfits_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trip_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_plans": {
                  Row: {
                    "activities": string | null,"created_at": string,"destination": string,"end_date": string,"forecast": Json | null,"id": string,"lat": number | null,"lon": number | null,"plan": Json | null,"preferences": string | null,"start_date": string,"user_id": string,"wardrobe_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activities"?: string | null,"created_at"?: string,"destination": string,"end_date": string,"forecast"?: Json | null,"id"?: string,"lat"?: number | null,"lon"?: number | null,"plan"?: Json | null,"preferences"?: string | null,"start_date": string,"user_id": string,"wardrobe_profile_id": string
                  }
                  Update: {
                    "activities"?: string | null,"created_at"?: string,"destination"?: string,"end_date"?: string,"forecast"?: Json | null,"id"?: string,"lat"?: number | null,"lon"?: number | null,"plan"?: Json | null,"preferences"?: string | null,"start_date"?: string,"user_id"?: string,"wardrobe_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_plans_wardrobe_profile_id_fkey"
      columns: ["wardrobe_profile_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_ai_usage": {
                  Row: {
                    "cost_inr": number,"cost_usd": number,"created_at": string,"error": string | null,"feature": string,"id": string,"images": number,"input_tokens": number,"latency_ms": number | null,"model": string,"operation": string,"output_tokens": number,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_inr"?: number,"cost_usd"?: number,"created_at"?: string,"error"?: string | null,"feature": string,"id"?: string,"images"?: number,"input_tokens"?: number,"latency_ms"?: number | null,"model": string,"operation": string,"output_tokens"?: number,"status": string,"user_id"?: string | null
                  }
                  Update: {
                    "cost_inr"?: number,"cost_usd"?: number,"created_at"?: string,"error"?: string | null,"feature"?: string,"id"?: string,"images"?: number,"input_tokens"?: number,"latency_ms"?: number | null,"model"?: string,"operation"?: string,"output_tokens"?: number,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"wardrobe_profiles": {
                  Row: {
                    "created_at": string,"id": string,"is_default": boolean,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"wear_history": {
                  Row: {
                    "created_at": string,"id": string,"item_ids": (string)[],"outfit_id": string | null,"user_id": string,"wardrobe_profile_id": string,"worn_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_ids": (string)[],"outfit_id"?: string | null,"user_id": string,"wardrobe_profile_id": string,"worn_on"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_ids"?: (string)[],"outfit_id"?: string | null,"user_id"?: string,"wardrobe_profile_id"?: string,"worn_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wear_history_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfit_combinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wear_history_wardrobe_profile_id_fkey"
      columns: ["wardrobe_profile_id"]
isOneToOne: false
      referencedRelation: "wardrobe_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "error": string | null,"event": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"event": string,"id": string,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string
                  }
                  Update: {
                    "error"?: string | null,"event"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "ai_quota":
{ Args: { "k": Database["public"]['Enums']["ai_kind"],"uid": string }; Returns: Json
                           },
"hold_ai_credit":
{ Args: { "k": Database["public"]['Enums']["ai_kind"],"reference": string,"uid": string,"why": string }; Returns: string
                           },
"my_quotas":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"period_start":
{ Args: { "uid": string }; Returns: string
                           },
"settle_ai_credit":
{ Args: { "credit": string,"ok": boolean }; Returns: undefined
                           },
"user_plan":
{ Args: { "uid": string }; Returns: string
                           }
          }
          Enums: {
            "ai_kind": "studio"|"styling"|"chat"|"ownit"|"trip"|"scan","credit_status": "held"|"charged"|"refunded","image_kind": "original"|"studio"|"thumb","job_status": "queued"|"processing"|"done"|"failed"|"paused","laundry_status": "clean"|"worn"|"in_laundry"|"unavailable"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "ai_kind": ["studio", "styling", "chat", "ownit", "trip", "scan"],"credit_status": ["held", "charged", "refunded"],"image_kind": ["original", "studio", "thumb"],"job_status": ["queued", "processing", "done", "failed", "paused"],"laundry_status": ["clean", "worn", "in_laundry", "unavailable"]
          }
        }
} as const
