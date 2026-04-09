export type JobStatus = 'new' | 'reviewing' | 'applied' | 'interview' | 'rejected' | 'offer';

export interface Job {
  id: number;
  external_id: string;
  title: string;
  company: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  is_remote: boolean;
  job_type: string | null;
  source: string;
  job_url: string;
  description: string | null;
  min_salary: number | null;
  max_salary: number | null;
  salary_currency: string;
  date_posted: string | null;
  date_scraped: string | null;
  hours_old: number | null;
  status: JobStatus;
  is_bookmarked: boolean;
  is_hidden: boolean;
  match_score: number | null;
  notes: string | null;
  scrape_config_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface JobsResponse {
  jobs: Job[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ScrapeRun {
  id: number;
  config_id: number;
  started_at: string | null;
  completed_at: string | null;
  status: string;
  total_found: number;
  new_jobs: number;
  duplicates: number;
  errors: string | null;
  log: string | null;
  config_name?: string;
}

export interface ScrapeConfig {
  id: number;
  name: string;
  search_terms: string[];
  sites: string[];
  locations: string[];
  distance: number;
  max_age_hours: number;
  results_per_site: number;
  job_types: string[] | null;
  include_remote: boolean;
  google_search_term: string | null;
  schedule: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  last_run: ScrapeRun | null;
}

export interface OverviewStats {
  total_jobs: number;
  new_today: number;
  bookmarked: number;
  applied: number;
  avg_min_salary: number | null;
  avg_max_salary: number | null;
}

export interface SourceData {
  source: string;
  count: number;
}

export interface TimeData {
  date: string;
  count: number;
}

export interface CompanyData {
  company: string;
  count: number;
}

export interface SalaryData {
  label: string;
  count: number;
}

export interface SkillData {
  skill: string;
  count: number;
}

export interface FunnelData {
  status: string;
  count: number;
}
