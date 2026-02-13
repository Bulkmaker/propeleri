"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { POSITIONS } from "@/lib/utils/constants";
import type { PlayerPosition, PlayerRole, AppRole } from "@/types/database";

/* ─── Form data shared by both admin and profile ─── */
export interface PlayerFormData {
  first_name: string;
  last_name: string;
  nickname: string;
  jersey_number: string;
  position: PlayerPosition | null;
  default_training_team: string;
  height: string;
  weight: string;
  date_of_birth: string;
  nationality: string | null;
  second_nationality: string | null;
  phone: string;
  bio: string;
}

export interface AdminFields {
  login: string;
  password: string;
  team_role: PlayerRole;
  app_role: AppRole;
  is_guest: boolean;
  is_active: boolean;
  is_approved: boolean;
}

export interface PlayerEditFormProps {
  /* Avatar */
  avatarUrl: string | null;
  avatarInitials: string;
  onAvatarFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingAvatar: boolean;
  cropDialogOpen: boolean;
  cropImageSrc: string | null;
  onCropClose: () => void;
  onCropConfirm: (blob: Blob) => void;

  /* Form fields */
  form: PlayerFormData;
  onFormChange: (form: PlayerFormData) => void;

  /* Admin-only fields (hidden when undefined) */
  adminFields?: AdminFields;
  onAdminFieldsChange?: (fields: AdminFields) => void;

  /* Actions */
  onSave: () => void;
  saving: boolean;
  error?: string;
  successMessage?: string;
  saveDisabled?: boolean;
}

export function PlayerEditForm({
  avatarUrl,
  avatarInitials,
  onAvatarFileSelect,
  uploadingAvatar,
  cropDialogOpen,
  cropImageSrc,
  onCropClose,
  onCropConfirm,
  form,
  onFormChange,
  adminFields,
  onAdminFieldsChange,
  onSave,
  saving,
  error,
  successMessage,
  saveDisabled,
}: PlayerEditFormProps) {
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const tp = useTranslations("positions");
  const tpr = useTranslations("profile");
  const tt = useTranslations("training");
  const tr = useTranslations("roles");
  const tAdmin = useTranslations("admin");

  const isAdmin = Boolean(adminFields);

  function updateForm(updates: Partial<PlayerFormData>) {
    onFormChange({ ...form, ...updates });
  }

  function updateAdmin(updates: Partial<AdminFields>) {
    if (adminFields && onAdminFieldsChange) {
      onAdminFieldsChange({ ...adminFields, ...updates });
    }
  }

  return (
    <div className="space-y-3">
      {/* Avatar */}
      <div className="flex items-center gap-4 border border-border/60 rounded-lg p-3">
        <Avatar className="h-16 w-16 shrink-0 ring-2 ring-primary/20">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="text-sm font-semibold">
            {avatarInitials}
          </AvatarFallback>
        </Avatar>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={onAvatarFileSelect}
            disabled={uploadingAvatar}
          />
          <Button variant="outline" size="sm" asChild disabled={uploadingAvatar}>
            <span>
              {uploadingAvatar ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {tpr("changeAvatar")}
            </span>
          </Button>
        </label>
        <AvatarCropDialog
          open={cropDialogOpen}
          imageSrc={cropImageSrc}
          onClose={onCropClose}
          onConfirm={onCropConfirm}
          title={tpr("cropAvatar")}
          saveLabel={tpr("cropSave")}
          cancelLabel={tc("cancel")}
        />
      </div>

      {/* Core fields — flat grid: 2 cols mobile, 3 cols desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>{ta("firstName")}</Label>
          <Input
            value={form.first_name}
            onChange={(e) => updateForm({ first_name: e.target.value })}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label>{ta("lastName")}</Label>
          <Input
            value={form.last_name}
            onChange={(e) => updateForm({ last_name: e.target.value })}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label>{tpr("nickname")}</Label>
          <Input
            value={form.nickname}
            onChange={(e) => updateForm({ nickname: e.target.value })}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label>{tpr("jerseyNumber")}</Label>
          <Input
            type="number"
            value={form.jersey_number}
            onChange={(e) => updateForm({ jersey_number: e.target.value })}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label>{tpr("position")}</Label>
          <Select
            value={form.position ?? "none"}
            onValueChange={(v) => updateForm({ position: v === "none" ? null : v as PlayerPosition })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSITIONS.map((pos) => (
                <SelectItem key={pos} value={pos}>
                  {tp(pos)}
                </SelectItem>
              ))}
              <SelectItem value="none">{tAdmin("noPosition")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin ? (
          <div className="space-y-2">
            <Label>{tAdmin("defaultTeam")}</Label>
            <Select
              value={form.default_training_team}
              onValueChange={(v) => updateForm({ default_training_team: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tt("noTeam")}</SelectItem>
                <SelectItem value="team_a">{tt("teamA")}</SelectItem>
                <SelectItem value="team_b">{tt("teamB")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>{tpr("dateOfBirth")}</Label>
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => updateForm({ date_of_birth: e.target.value })}
              className="bg-background"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label>{tpr("height")}</Label>
          <Input
            type="number"
            value={form.height}
            onChange={(e) => updateForm({ height: e.target.value })}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label>{tpr("weight")}</Label>
          <Input
            type="number"
            value={form.weight}
            onChange={(e) => updateForm({ weight: e.target.value })}
            className="bg-background"
          />
        </div>
        {isAdmin && (
          <div className="space-y-2">
            <Label>{tpr("dateOfBirth")}</Label>
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => updateForm({ date_of_birth: e.target.value })}
              className="bg-background"
            />
          </div>
        )}
      </div>

      {/* Row 4: Nationality, Second nationality */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{tpr("nationality")}</Label>
          <CountrySelect
            value={form.nationality}
            onChange={(val) => updateForm({ nationality: val })}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          {form.second_nationality !== null ? (
            <>
              <div className="flex items-center justify-between">
                <Label>{tpr("secondNationality")}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  onClick={() => updateForm({ second_nationality: null })}
                >
                  <span className="sr-only">{tc("delete")}</span>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <CountrySelect
                value={form.second_nationality === "none" ? null : form.second_nationality}
                onChange={(val) => updateForm({ second_nationality: val })}
                className="bg-background"
              />
            </>
          ) : (
            <>
              <Label className="invisible">-</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateForm({ second_nationality: "none" })}
                className="gap-2 text-muted-foreground w-full"
              >
                <span className="text-lg leading-none">+</span>
                {tpr("secondNationality")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label>{tpr("phone")}</Label>
        <Input
          value={form.phone}
          onChange={(e) => updateForm({ phone: e.target.value })}
          className="bg-background"
        />
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label>{tpr("bio")}</Label>
        <Input
          value={form.bio}
          onChange={(e) => updateForm({ bio: e.target.value })}
          className="bg-background"
        />
      </div>

      {/* Admin-only fields */}
      {adminFields && onAdminFieldsChange && (
        <>
          {/* Login / Password */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{tAdmin("loginField")}</Label>
              <Input
                value={adminFields.login}
                onChange={(e) => updateAdmin({ login: e.target.value })}
                placeholder={tAdmin("credentialsOptional")}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("loginPassword")}</Label>
              <Input
                type="text"
                value={adminFields.password}
                onChange={(e) => updateAdmin({ password: e.target.value })}
                placeholder={tAdmin("credentialsOptional")}
                className="bg-background"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{tAdmin("credentialsHint")}</p>

          {/* Team role / System role */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{tAdmin("teamRoleColumn")}</Label>
              <Select
                value={adminFields.team_role}
                onValueChange={(v) => updateAdmin({ team_role: v as PlayerRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">{tr("player")}</SelectItem>
                  <SelectItem value="captain">{tr("captain")}</SelectItem>
                  <SelectItem value="assistant_captain">{tr("assistantCaptain")}</SelectItem>
                  <SelectItem value="coach">{tr("coach")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("appRole")}</Label>
              <Select
                value={adminFields.app_role}
                onValueChange={(v) => updateAdmin({ app_role: v as AppRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">{tr("player")}</SelectItem>
                  <SelectItem value="admin">{tc("admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Switches */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={adminFields.is_guest}
                onCheckedChange={(checked) => updateAdmin({ is_guest: checked === true })}
              />
              <span className="text-sm">{tt("guest")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={adminFields.is_active}
                onCheckedChange={(checked) => updateAdmin({ is_active: checked === true })}
              />
              <span className="text-sm">{tAdmin("active")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={adminFields.is_approved}
                onCheckedChange={(checked) => updateAdmin({ is_approved: checked === true })}
              />
              <span className="text-sm">{tAdmin("approved")}</span>
            </label>
          </div>
        </>
      )}

      {/* Messages */}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2">
          {successMessage}
        </p>
      )}

      {/* Save */}
      <Button
        onClick={onSave}
        disabled={saving || saveDisabled}
        className="w-full bg-primary"
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {tc("save")}
      </Button>
    </div>
  );
}
