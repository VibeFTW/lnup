-- ============================================================
-- EVENT UPDATES (host announcements)
-- ============================================================

CREATE TABLE public.event_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  body TEXT NOT NULL CHECK (char_length(body) <= 1000),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_updates_event ON public.event_updates(event_id);
CREATE INDEX idx_updates_author ON public.event_updates(author_id);

ALTER TABLE public.event_updates ENABLE ROW LEVEL SECURITY;

-- Anyone can read updates for events they can see
CREATE POLICY "Updates are public" ON public.event_updates FOR SELECT USING (true);

-- Only event creator or admin can post updates
CREATE POLICY "Event creators can post updates" ON public.event_updates FOR INSERT WITH CHECK (
  auth.uid() = author_id AND (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- Author can delete own updates
CREATE POLICY "Authors can delete own updates" ON public.event_updates FOR DELETE USING (
  auth.uid() = author_id
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Update the events_with_counts view to include updates_count
CREATE OR REPLACE VIEW public.events_with_counts AS
SELECT
  e.*,
  COALESCE(s.saves_count, 0) AS saves_count,
  COALESCE(g.going_count, 0) AS going_count,
  COALESCE(c.confirmations_count, 0) AS confirmations_count,
  COALESCE(p.photos_count, 0) AS photos_count,
  COALESCE(u.updates_count, 0) AS updates_count
FROM public.events e
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS saves_count FROM public.event_saves WHERE event_id = e.id
) s ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS going_count FROM public.event_confirmations WHERE event_id = e.id AND status = 'going'
) g ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS confirmations_count FROM public.event_confirmations WHERE event_id = e.id AND status = 'attended'
) c ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS photos_count FROM public.event_photos WHERE event_id = e.id AND status = 'approved'
) p ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS updates_count FROM public.event_updates WHERE event_id = e.id
) u ON true;
