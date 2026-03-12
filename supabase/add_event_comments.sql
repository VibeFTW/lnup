-- Event Comments
CREATE TABLE IF NOT EXISTS public.event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_comments_event ON public.event_comments(event_id);
CREATE INDEX idx_event_comments_user ON public.event_comments(user_id);

ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are public" ON public.event_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON public.event_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.event_comments FOR DELETE USING (auth.uid() = user_id);
