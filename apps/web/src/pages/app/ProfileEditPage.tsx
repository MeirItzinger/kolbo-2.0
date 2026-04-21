import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ProfileAvatar } from '@/components/profiles';
import { getProfile, createProfile, updateProfile } from '@/api/profiles';

export default function ProfileEditPage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = profileId === 'new';

  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isKidsProfile, setIsKidsProfile] = useState(false);
  const [saving, setSaving] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['profiles', profileId],
    queryFn: () => getProfile(profileId!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name);
      setAvatarUrl(profileQuery.data.avatarUrl);
      setIsKidsProfile(profileQuery.data.isKidsProfile);
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => isNew ? createProfile(data) : updateProfile(profileId!, data),
    onMutate: () => setSaving(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      navigate('/account/profiles');
    },
    onSettled: () => setSaving(false),
  });

  const handleSave = () => {
    saveMutation.mutate({ name, avatarUrl, isKidsProfile });
  };

  if (profileQuery.isLoading && !isNew) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/account/profiles')}
          className="mr-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-white">
          {isNew ? 'Add Profile' : 'Edit Profile'}
        </h1>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex justify-center">
            <ProfileAvatar
              avatarUrl={avatarUrl}
              name={name || 'New Profile'}
              size="xl"
              className="cursor-pointer hover:opacity-90 transition-opacity"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-surface-400">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter profile name"
              maxLength={50}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Kids profile</p>
              <p className="text-sm text-surface-400">Restrict content to appropriate ages</p>
            </div>
            <button
              type="button"
              onClick={() => setIsKidsProfile(!isKidsProfile)}
              className={`h-6 w-11 rounded-full transition-colors ${isKidsProfile ? 'bg-primary-500' : 'bg-surface-700'}`}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${isKidsProfile ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>

          {!isNew && (
            <Button
              variant="outline"
              onClick={() => navigate(`/account/profiles/${profileId}/controls`)}
              className="w-full"
            >
              Manage Parental Controls
            </Button>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => navigate('/account/profiles')}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name || saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
