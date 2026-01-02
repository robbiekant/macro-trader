export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      macro_snapshots: {
        Row: {
          id: string
          user_id: string
          created_at: string
          business_cycle: string
          economic_cycle: string
          global_liquidity: string
          macro_outlook: string
          snapshot_data: Json
          analysis_input_data: Json | null
          analysis_logic: string | null
          analysis_output_data: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
          business_cycle?: string
          economic_cycle?: string
          global_liquidity?: string
          macro_outlook?: string
          snapshot_data?: Json
          analysis_input_data?: Json | null
          analysis_logic?: string | null
          analysis_output_data?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          business_cycle?: string
          economic_cycle?: string
          global_liquidity?: string
          macro_outlook?: string
          snapshot_data?: Json
          analysis_input_data?: Json | null
          analysis_logic?: string | null
          analysis_output_data?: Json | null
        }
      }
      interest_rates: {
        Row: {
          id: string
          snapshot_id: string
          country: string
          current_rate: number
          direction: string
          policy_stance: string
        }
        Insert: {
          id?: string
          snapshot_id: string
          country: string
          current_rate?: number
          direction?: string
          policy_stance?: string
        }
        Update: {
          id?: string
          snapshot_id?: string
          country?: string
          current_rate?: number
          direction?: string
          policy_stance?: string
        }
      }
      market_valuations: {
        Row: {
          id: string
          snapshot_id: string
          index_name: string
          pe_ratio: number
          valuation_level: string
        }
        Insert: {
          id?: string
          snapshot_id: string
          index_name: string
          pe_ratio?: number
          valuation_level?: string
        }
        Update: {
          id?: string
          snapshot_id?: string
          index_name?: string
          pe_ratio?: number
          valuation_level?: string
        }
      }
      commodity_fundamentals: {
        Row: {
          id: string
          snapshot_id: string
          commodity: string
          supply_outlook: string
          demand_outlook: string
          fundamental_bias: string
        }
        Insert: {
          id?: string
          snapshot_id: string
          commodity: string
          supply_outlook?: string
          demand_outlook?: string
          fundamental_bias?: string
        }
        Update: {
          id?: string
          snapshot_id?: string
          commodity?: string
          supply_outlook?: string
          demand_outlook?: string
          fundamental_bias?: string
        }
      }
      ai_recommendations: {
        Row: {
          id: string
          snapshot_id: string
          asset_class: string
          recommendation: string
          conviction_level: string
          time_horizon: string
          rationale: string
          created_at: string
        }
        Insert: {
          id?: string
          snapshot_id: string
          asset_class: string
          recommendation?: string
          conviction_level?: string
          time_horizon?: string
          rationale?: string
          created_at?: string
        }
        Update: {
          id?: string
          snapshot_id?: string
          asset_class?: string
          recommendation?: string
          conviction_level?: string
          time_horizon?: string
          rationale?: string
          created_at?: string
        }
      }
      options_strategies: {
        Row: {
          id: string
          recommendation_id: string
          asset_class: string
          strategy_type: string
          dte: number
          spot_price: number
          implied_volatility: number
          strike_price: number
          strike_price_put: number
          strike_price_call: number
          premium_collected: number
          buying_power_required: number
          manual_input: boolean
          created_at: string
        }
        Insert: {
          id?: string
          recommendation_id: string
          asset_class: string
          strategy_type: string
          dte?: number
          spot_price?: number
          implied_volatility?: number
          strike_price?: number
          strike_price_put?: number
          strike_price_call?: number
          premium_collected?: number
          buying_power_required?: number
          manual_input?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          recommendation_id?: string
          asset_class?: string
          strategy_type?: string
          dte?: number
          spot_price?: number
          implied_volatility?: number
          strike_price?: number
          strike_price_put?: number
          strike_price_call?: number
          premium_collected?: number
          buying_power_required?: number
          manual_input?: boolean
          created_at?: string
        }
      }
    }
  }
}
