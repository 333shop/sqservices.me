// Supabase Edge Function: serves your UI + loader only to valid API keys.
// Users run:  loadstring(game:HttpGet("https://YOUR-PROJECT.supabase.co/functions/v1/loader?key=THEIR_KEY"))()
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Lua that runs on the user's side (generated from loader.lua)
const LUA_BODY = String.raw`local HttpService = game:GetService("HttpService")
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local httpRequest = (syn and syn.request) or (http and http.request) or http_request or request

-- ---------- on-screen errors ----------
local function fail(msg)
	warn("[sqservices loader] " .. tostring(msg))
	pcall(function()
		local gui = Instance.new("ScreenGui")
		gui.Name = "sqservicesError"
		gui.ResetOnSpawn = false
		gui.DisplayOrder = 2000
		gui.Parent = (gethui and gethui()) or Players.LocalPlayer:WaitForChild("PlayerGui")
		local box = Instance.new("TextLabel")
		box.Size = UDim2.new(0, 440, 0, 100)
		box.Position = UDim2.new(0.5, -220, 0, 20)
		box.BackgroundColor3 = Color3.fromRGB(120, 20, 30)
		box.TextColor3 = Color3.new(1, 1, 1)
		box.TextWrapped = true
		box.Font = Enum.Font.Code
		box.TextSize = 14
		box.Text = "sqservices loader error:\n" .. tostring(msg)
		box.Parent = gui
		Instance.new("UICorner", box)
		task.delay(15, function() gui:Destroy() end)
	end)
end

-- ---------- network ----------
local function rpc(fn, body)
	local payload = {
		Url = SUPABASE_URL .. "/rest/v1/rpc/" .. fn,
		Method = "POST",
		Headers = {
			["Content-Type"] = "application/json",
			["apikey"] = SUPABASE_ANON_KEY,
			["Authorization"] = "Bearer " .. SUPABASE_ANON_KEY,
		},
		Body = HttpService:JSONEncode(body),
	}
	local ok, res
	if httpRequest then
		ok, res = pcall(httpRequest, payload)
	else
		ok, res = pcall(function() return HttpService:RequestAsync(payload) end)
	end
	if not ok or not res or not res.StatusCode or res.StatusCode < 200 or res.StatusCode >= 300 then return nil end
	local dok, data = pcall(function() return HttpService:JSONDecode(res.Body) end)
	return dok and data or {}
end

local function gameName()
	local ok, info = pcall(function() return MarketplaceService:GetProductInfo(game.PlaceId) end)
	return ok and info.Name or "Unknown game"
end

-- ---------- main window (built after the key is accepted) ----------
local function openMain(Library, key, email)
	local function sync()
		return rpc("log_game", { p_key = key, p_place = game.PlaceId, p_name = gameName() })
	end
	local synced = sync()

	local Window = Library.new({
		Title = "sqservices.me",
		Subtitle = "dashboard",
		Size = UDim2.fromOffset(640, 480),
		ToggleKey = Enum.KeyCode.RightShift,
	})

	local Home = Window:AddTab("Home")
	local acct = Home:AddSection("Account", "Left")
	acct:AddLabel("Email: " .. tostring(email))
	acct:AddLabel("Game: " .. gameName())
	local status = acct:AddLabel(synced and "Status: synced to dashboard" or "Status: sync failed")
	acct:AddButton({ Name = "Sync game", Callback = function()
		local ok = sync()
		status:Set(ok and "Status: synced to dashboard" or "Status: sync failed")
		Library:Notify(ok and "Synced to your dashboard" or "Sync failed")
	end })
	acct:AddButton({ Name = "Copy website link", Callback = function()
		if setclipboard then setclipboard(SITE) end
		Library:Notify("Copied " .. SITE)
	end })

	local info = Home:AddSection("Info", "Right")
	info:AddLabel("Menu key: RightShift")
	info:AddLabel("View your games at")
	info:AddLabel(SITE)

	-- Add your features to new tabs/sections here, e.g.
	-- local Main = Window:AddTab("Main")
	-- Main:AddSection("Combat", "Left"):AddToggle({ Name = "Example", Flag = "example" })

	local Settings = Window:AddTab("Settings")
	local look = Settings:AddSection("Appearance", "Left")
	look:AddColorPicker({ Name = "Accent color", Default = Color3.fromRGB(250, 170, 235), Callback = function(c) Library:SetAccent(c) end })
	local misc = Settings:AddSection("Menu", "Right")
	misc:AddButton({ Name = "Unload", Callback = function() Window:Destroy() end })

	Library:Notify("Welcome to sqservices.me")
end


-- ---------- start ----------
local function main()
	local fn, err = loadstring(UI_SRC)
	if not fn then return fail("UI error: " .. tostring(err)) end
	local okUI, Library = pcall(fn)
	if not okUI or type(Library) ~= "table" then return fail("UI did not load: " .. tostring(Library)) end

	local res = rpc("validate_key", { p_key = SQ_KEY })
	if not (res and res.valid and res.email) then
		return fail(res and "Invalid key. Copy a fresh loadstring from sqservices.me" or "Could not reach sqservices.me")
	end
	openMain(Library, SQ_KEY, res.email)
end

local ok, err = pcall(main)
if not ok then fail(err) end
`;

// Safe Lua long-string literal for any text (your UI source)
function q(s: string): string {
  let n = 0;
  while (s.includes("]" + "=".repeat(n) + "]")) n++;
  const eq = "=".repeat(n);
  return "[" + eq + "[\n" + s + "]" + eq + "]";
}

const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
const deny = (m: string) => new Response(`warn("sqservices: ${m}")`, { headers });

Deno.serve(async (req) => {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!/^sq_[a-f0-9]{64}$/.test(key)) return deny("invalid key");

  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: prof } = await sb.from("profiles").select("id").eq("api_key", key).maybeSingle();
  if (!prof) return deny("invalid key");

  const { data: ui } = await sb.from("app_scripts").select("source").eq("name", "ui").maybeSingle();
  if (!ui) return deny("UI not uploaded yet");

  const lua =
    `local SQ_KEY = ${JSON.stringify(key)}\n` +
    `local SUPABASE_URL = ${JSON.stringify(url)}\n` +
    `local SUPABASE_ANON_KEY = ${JSON.stringify(Deno.env.get("SUPABASE_ANON_KEY") ?? "")}\n` +
    `local SITE = "https://sqservices.me"\n` +
    `local UI_SRC = ${q(ui.source)}\n` +
    LUA_BODY;
  return new Response(lua, { headers });
});
