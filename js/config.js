/* Community server settings. Leave both empty to run Social in single-device preview mode.
   The anon key is designed to be public: the database's row level security is what protects data.
   Never put the service_role key here. See SETUP-COMMUNITY.md. */
window.KERYKE_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
