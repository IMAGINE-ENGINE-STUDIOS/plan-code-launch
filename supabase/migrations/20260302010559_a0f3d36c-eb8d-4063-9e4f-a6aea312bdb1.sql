
-- Add dependencies column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS dependencies jsonb DEFAULT '{}'::jsonb;

-- Create published-sites storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('published-sites', 'published-sites', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to published sites
CREATE POLICY "Published sites are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'published-sites');

-- Allow authenticated users to upload to their project folders
CREATE POLICY "Service role can upload published sites"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'published-sites');

-- Allow updates to published sites
CREATE POLICY "Service role can update published sites"
ON storage.objects FOR UPDATE
USING (bucket_id = 'published-sites');

-- Allow deletes on published sites
CREATE POLICY "Service role can delete published sites"
ON storage.objects FOR DELETE
USING (bucket_id = 'published-sites');
