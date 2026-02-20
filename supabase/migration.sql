-- LNUP Database Schema
-- Run this in Supabase SQL Editor to set up all tables

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'verified_organizer', 'verified_user', 'user')),
  trust_score INTEGER NOT NULL DEFAULT 0,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, email_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', 'Neuer User'),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- VENUES
-- ============================================================
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  google_place_id TEXT,
  website TEXT,
  instagram TEXT,
  phone TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_venues_location ON public.venues(lat, lng);
CREATE INDEX idx_venues_owner ON public.venues(owner_id);

-- ============================================================
-- EVENT SERIES (recurring events)
-- ============================================================
CREATE TABLE public.event_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id),
  venue_id UUID REFERENCES public.venues(id),
  title TEXT NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'weekly',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  venue_id UUID REFERENCES public.venues(id),
  series_id UUID REFERENCES public.event_series(id),
  event_date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('nightlife', 'food_drink', 'concert', 'festival', 'sports', 'art', 'family', 'other')),
  price_info TEXT,
  source_type TEXT NOT NULL DEFAULT 'community' CHECK (source_type IN ('api_eventbrite', 'api_ticketmaster', 'platform', 'verified_organizer', 'verified_user', 'community')),
  source_url TEXT,
  created_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'removed', 'past')),
  ai_confidence DOUBLE PRECISION,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_category ON public.events(category);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_venue ON public.events(venue_id);
CREATE INDEX idx_events_creator ON public.events(created_by);
CREATE INDEX idx_events_series ON public.events(series_id);

-- ============================================================
-- EVENT PHOTOS
-- ============================================================
CREATE TABLE public.event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_photos_event ON public.event_photos(event_id);
CREATE INDEX idx_photos_status ON public.event_photos(status);

-- ============================================================
-- EVENT SAVES (bookmarks)
-- ============================================================
CREATE TABLE public.event_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_saves_user ON public.event_saves(user_id);

-- ============================================================
-- EVENT CONFIRMATIONS (attendance)
-- ============================================================
CREATE TABLE public.event_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'attended', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_confirmations_event ON public.event_confirmations(event_id);

-- ============================================================
-- EVENT REPORTS
-- ============================================================
CREATE TABLE public.event_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT NOT NULL CHECK (reason IN ('fake', 'wrong_info', 'spam', 'duplicate')),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, reported_by)
);

-- ============================================================
-- SCRAPE SOURCES (for AI pipeline)
-- ============================================================
CREATE TABLE public.scrape_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'website',
  city TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  last_scraped TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRUST SCORE FUNCTIONS
-- ============================================================

-- Compute rank label from trust_score
CREATE OR REPLACE FUNCTION public.get_rank(score INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN score >= 1500 THEN 'city_icon'
    WHEN score >= 800 THEN 'big_fish'
    WHEN score >= 500 THEN 'scene_master'
    WHEN score >= 300 THEN 'party_planner'
    WHEN score >= 150 THEN 'insider'
    WHEN score >= 75 THEN 'regular'
    WHEN score >= 25 THEN 'explorer'
    ELSE 'newbie'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add points to a user
CREATE OR REPLACE FUNCTION public.add_trust_points(target_user_id UUID, points INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET trust_score = GREATEST(0, trust_score + points)
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award points when an event is created
CREATE OR REPLACE FUNCTION public.on_event_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    PERFORM public.add_trust_points(NEW.created_by, 3);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_event_created
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.on_event_created();

-- Award points when attendance is confirmed (only on 'attended', not 'going')
CREATE OR REPLACE FUNCTION public.on_confirmation_changed()
RETURNS TRIGGER AS $$
DECLARE
  event_creator UUID;
  was_going BOOLEAN;
BEGIN
  -- On INSERT with 'going' status: no points awarded
  IF TG_OP = 'INSERT' AND NEW.status = 'going' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE to 'attended': award points
  IF (TG_OP = 'INSERT' AND NEW.status = 'attended') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'attended' AND OLD.status != 'attended') THEN

    -- Check if they had 'going' before -> bonus for follow-through
    was_going := TG_OP = 'UPDATE' AND OLD.status = 'going';

    -- Give 1 point (or 2 if they followed through from 'going')
    PERFORM public.add_trust_points(NEW.user_id, CASE WHEN was_going THEN 2 ELSE 1 END);

    -- Give 2 points to the event creator
    SELECT created_by INTO event_creator FROM public.events WHERE id = NEW.event_id;
    IF event_creator IS NOT NULL THEN
      PERFORM public.add_trust_points(event_creator, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_confirmation_changed
  AFTER INSERT OR UPDATE ON public.event_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.on_confirmation_changed();

-- Deduct points when an event is reported
CREATE OR REPLACE FUNCTION public.on_report_created()
RETURNS TRIGGER AS $$
DECLARE
  event_creator UUID;
  report_count INTEGER;
BEGIN
  SELECT created_by INTO event_creator FROM public.events WHERE id = NEW.event_id;

  -- Count reports for this event
  SELECT COUNT(*) INTO report_count FROM public.event_reports WHERE event_id = NEW.event_id;

  -- Auto-flag at 3 reports
  IF report_count >= 3 THEN
    UPDATE public.events SET status = 'flagged' WHERE id = NEW.event_id AND status = 'active';
  END IF;

  -- Auto-remove at 5 reports
  IF report_count >= 5 THEN
    UPDATE public.events SET status = 'removed' WHERE id = NEW.event_id;
    IF event_creator IS NOT NULL THEN
      PERFORM public.add_trust_points(event_creator, -50);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_report_created
  AFTER INSERT ON public.event_reports
  FOR EACH ROW EXECUTE FUNCTION public.on_report_created();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_sources ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, own write
CREATE POLICY "Profiles are public" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Venues: public read, authenticated create
CREATE POLICY "Venues are public" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create venues" ON public.venues FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Owners can update venues" ON public.venues FOR UPDATE USING (auth.uid() = owner_id);

-- Events: public read active, authenticated create
CREATE POLICY "Active events are public" ON public.events FOR SELECT USING (status IN ('active', 'past'));
CREATE POLICY "Authenticated users can create events" ON public.events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Creators can update own events" ON public.events FOR UPDATE USING (auth.uid() = created_by);

-- Event series: public read, creator write
CREATE POLICY "Event series are public" ON public.event_series FOR SELECT USING (true);
CREATE POLICY "Creators can manage series" ON public.event_series FOR ALL USING (auth.uid() = host_id);

-- Photos: approved are public, users manage own
CREATE POLICY "Approved photos are public" ON public.event_photos FOR SELECT USING (status = 'approved' OR uploaded_by = auth.uid());
CREATE POLICY "Authenticated users can upload photos" ON public.event_photos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Uploaders can delete own photos" ON public.event_photos FOR DELETE USING (auth.uid() = uploaded_by);

-- Saves: own only
CREATE POLICY "Users see own saves" ON public.event_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save events" ON public.event_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave events" ON public.event_saves FOR DELETE USING (auth.uid() = user_id);

-- Confirmations: public read (counts), own write
CREATE POLICY "Confirmations are public" ON public.event_confirmations FOR SELECT USING (true);
CREATE POLICY "Users can confirm attendance" ON public.event_confirmations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reports: own only
CREATE POLICY "Users see own reports" ON public.event_reports FOR SELECT USING (auth.uid() = reported_by);
CREATE POLICY "Users can report events" ON public.event_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);

-- Scrape sources: admin only (no public RLS, managed via service role)
CREATE POLICY "Scrape sources are admin only" ON public.scrape_sources FOR ALL USING (false);

-- ============================================================
-- VIEWS for common queries
-- ============================================================

CREATE OR REPLACE VIEW public.events_with_counts AS
SELECT
  e.*,
  COALESCE(s.saves_count, 0) AS saves_count,
  COALESCE(g.going_count, 0) AS going_count,
  COALESCE(c.confirmations_count, 0) AS confirmations_count,
  COALESCE(p.photos_count, 0) AS photos_count
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
) p ON true;
