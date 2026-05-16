import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { Phone, Mail, Globe, MapPin, Share2, Download, Paintbrush } from 'lucide-react';

interface CardProfile {
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  tagline: string | null;
  website: string | null;
  service_area: string | null;
}

export function BusinessCard() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<CardProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (slug) loadCard();
  }, [slug]);

  async function loadCard() {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, business_name, email, phone, city, province, tagline, website, service_area')
      .eq('card_slug', slug)
      .maybeSingle();

    if (data) {
      setProfile(data);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  }

  function generateVCard() {
    if (!profile) return;
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${profile.full_name}`,
      `ORG:${profile.business_name}`,
      profile.phone ? `TEL;TYPE=WORK:${profile.phone}` : '',
      profile.email ? `EMAIL;TYPE=WORK:${profile.email}` : '',
      profile.website ? `URL:${profile.website}` : '',
      profile.city ? `ADR;TYPE=WORK:;;${profile.city};${profile.province};;;` : '',
      profile.tagline ? `NOTE:${profile.tagline}` : '',
      'END:VCARD',
    ].filter(Boolean).join('\n');

    const blob = new Blob([lines], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.business_name || profile.full_name}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: profile?.business_name || 'Business Card',
        text: profile?.tagline || `Contact ${profile?.full_name}`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Paintbrush className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-1">Card not found</h1>
          <p className="text-gray-500 text-sm">This business card doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const cardUrl = window.location.href;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 px-6 pt-8 pb-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Paintbrush className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{profile.business_name}</h1>
                  <p className="text-teal-100 text-sm">{profile.full_name}</p>
                </div>
              </div>
              {profile.tagline && (
                <p className="text-teal-200 text-sm mt-3 italic">{profile.tagline}</p>
              )}
            </div>
          </div>

          {/* Contact details */}
          <div className="px-6 -mt-6 relative z-10">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <Phone className="w-4 h-4 text-teal-600" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium">{profile.phone}</span>
                </a>
              )}
              {profile.email && (
                <a href={`mailto:${profile.email}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <Mail className="w-4 h-4 text-teal-600" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium">{profile.email}</span>
                </a>
              )}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <Globe className="w-4 h-4 text-teal-600" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium">{profile.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              {profile.service_area && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-teal-600" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium">{profile.service_area}</span>
                </div>
              )}
            </div>
          </div>

          {/* QR Code */}
          <div className="px-6 py-6 flex flex-col items-center">
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
              <QRCodeSVG value={cardUrl} size={120} level="M" />
            </div>
            <p className="text-xs text-gray-400 mt-2">Scan to save this card</p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={generateVCard}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Save Contact
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Powered by Pintura</p>
      </div>
    </div>
  );
}
