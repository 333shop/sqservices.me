--[[
    sqservices.me  •  ESP only
    - Glass UI (S logo, hide button, time/IP pill, recolorable)
    - Working ESP on other players' bodies:
        Box, Name, Distance, Health bar, Body Chams (Highlight, visible through walls)
    - 3D model preview panel (tap Box / Name / Distance / Health on it to toggle)

    Run it directly. Settings live in the returned table, e.g.
        local sq = loadstring(game:HttpGet("..."))()
        sq.Settings.MaxDistance = 800
        sq.Window.SetAccent(Color3.fromRGB(170, 70, 255))
        sq.Destroy()
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local HttpService = game:GetService("HttpService")
local LocalPlayer = Players.LocalPlayer

-- remove an older copy if you run it twice
pcall(function()
    local g = (getgenv and getgenv()) or _G
    if g.sqservicesESP then g.sqservicesESP.Destroy() end
end)

local WHITE, BLACK = Color3.new(1, 1, 1), Color3.new(0, 0, 0)
local Conns, Binds = {}, {}

local function Connect(signal, fn)
    local c = signal:Connect(fn)
    table.insert(Conns, c)
    return c
end

local function GuiParent()
    local ok, p = pcall(function()
        return (gethui and gethui()) or game:GetService("CoreGui")
    end)
    if ok and p then return p end
    return LocalPlayer:WaitForChild("PlayerGui")
end

local function Tween(obj, props, t, style, dir)
    local tw = TweenService:Create(obj, TweenInfo.new(t or 0.25, style or Enum.EasingStyle.Quint, dir or Enum.EasingDirection.Out), props)
    tw:Play()
    return tw
end

local function Create(class, props, parent)
    local i = Instance.new(class)
    for k, v in pairs(props or {}) do i[k] = v end
    if parent then i.Parent = parent end
    return i
end

local function Corner(p, r) return Create("UICorner", {CornerRadius = UDim.new(0, r)}, p) end
local function Stroke(p, c, th, tr)
    return Create("UIStroke", {Color = c, Thickness = th or 1, Transparency = tr or 0.5, ApplyStrokeMode = Enum.ApplyStrokeMode.Border}, p)
end
local function Mix(a, b, t) return a:Lerp(b, t) end
local function IsPress(i) return i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch end
local function IsMove(i) return i.UserInputType == Enum.UserInputType.MouseMovement or i.UserInputType == Enum.UserInputType.Touch end
local function Hex(c) return string.format("#%02x%02x%02x", math.floor(c.R * 255 + .5), math.floor(c.G * 255 + .5), math.floor(c.B * 255 + .5)) end

-------------------------------------------------
-- SETTINGS
-------------------------------------------------
local S = {
    Enabled = true,
    TeamCheck = false,
    MaxDistance = 1500,
    Box = true,
    Name = true,
    Distance = true,
    Health = true,
    Chams = true,
    BoxColor = Color3.fromRGB(150, 130, 255),
    NameColor = Color3.fromRGB(235, 240, 255),
    DistanceColor = Color3.fromRGB(160, 175, 210),
    ChamsFill = Color3.fromRGB(110, 90, 255),
    ChamsOutline = Color3.fromRGB(235, 230, 255),
    ChamsFillTransparency = 0.55,
}

local Theme = {
    Background = Color3.fromRGB(10, 13, 26),
    Accent = Color3.fromRGB(55, 115, 220),
    Text = Color3.fromRGB(225, 235, 255),
    SubText = Color3.fromRGB(145, 160, 195),
    Transparency = 0.2,
}

local function Bind(fn)
    table.insert(Binds, fn)
    pcall(fn, Theme)
end
local function Refresh()
    for _, fn in ipairs(Binds) do pcall(fn, Theme) end
end
local function ElementColor(t)
    return Mix(Mix(t.Background, t.Accent, 0.22), WHITE, 0.04)
end

-------------------------------------------------
-- ESP ENGINE
-------------------------------------------------
local EspGui = Create("ScreenGui", {
    Name = HttpService:GenerateGUID(false),
    ResetOnSpawn = false,
    IgnoreGuiInset = true,          -- so WorldToViewportPoint lines up with GUI pixels
    DisplayOrder = 500,
    ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
}, GuiParent())
local ChamFolder = Create("Folder", {Name = "Chams"}, GuiParent())

local Objects = {}

local function NewObject(plr)
    local o = {Player = plr}
    o.Folder = Create("Folder", {Name = plr.Name}, EspGui)

    o.Box = Create("Frame", {BackgroundTransparency = 1, BorderSizePixel = 0, Visible = false}, o.Folder)
    o.BoxStroke = Create("UIStroke", {Thickness = 1.5, ApplyStrokeMode = Enum.ApplyStrokeMode.Border}, o.Box)

    o.HealthTrack = Create("Frame", {BackgroundColor3 = BLACK, BackgroundTransparency = 0.4, BorderSizePixel = 0, Visible = false}, o.Folder)
    o.HealthFill = Create("Frame", {AnchorPoint = Vector2.new(0, 1), Position = UDim2.fromScale(0, 1), Size = UDim2.fromScale(1, 1), BorderSizePixel = 0}, o.HealthTrack)

    o.NameLabel = Create("TextLabel", {
        AnchorPoint = Vector2.new(0.5, 1), Size = UDim2.fromOffset(200, 14), BackgroundTransparency = 1,
        Font = Enum.Font.GothamMedium, TextSize = 12, TextStrokeTransparency = 0.5, Visible = false,
    }, o.Folder)
    o.DistLabel = Create("TextLabel", {
        AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.fromOffset(200, 14), BackgroundTransparency = 1,
        Font = Enum.Font.Gotham, TextSize = 11, TextStrokeTransparency = 0.5, Visible = false,
    }, o.Folder)

    o.Highlight = Create("Highlight", {
        Name = plr.Name, DepthMode = Enum.HighlightDepthMode.AlwaysOnTop, OutlineTransparency = 0, Enabled = false,
    }, ChamFolder)

    Objects[plr] = o
    return o
end

local function HideGui(o)
    o.Box.Visible, o.HealthTrack.Visible, o.NameLabel.Visible, o.DistLabel.Visible = false, false, false, false
end

local function HideAll(o)
    HideGui(o)
    o.Highlight.Enabled = false
end

local function UpdateObject(o, camera)
    local plr = o.Player
    local char = plr.Character
    local hum = char and char:FindFirstChildOfClass("Humanoid")
    local root = char and (char:FindFirstChild("HumanoidRootPart") or char.PrimaryPart)

    if not (S.Enabled and char and hum and root) or hum.Health <= 0 then
        return HideAll(o)
    end
    if S.TeamCheck and plr.Team ~= nil and plr.Team == LocalPlayer.Team then
        return HideAll(o)
    end

    local dist = (camera.CFrame.Position - root.Position).Magnitude
    if dist > S.MaxDistance then
        return HideAll(o)
    end

    -- body chams
    if S.Chams then
        if o.Highlight.Adornee ~= char then o.Highlight.Adornee = char end
        o.Highlight.FillColor = S.ChamsFill
        o.Highlight.FillTransparency = S.ChamsFillTransparency
        o.Highlight.OutlineColor = S.ChamsOutline
        o.Highlight.Enabled = true
    else
        o.Highlight.Enabled = false
    end

    -- screen box from head top to feet
    local head = char:FindFirstChild("Head")
    local topPos = head and (head.Position + Vector3.new(0, head.Size.Y / 2 + 0.15, 0)) or (root.Position + Vector3.new(0, 2.7, 0))
    local botPos = root.Position - Vector3.new(0, 3, 0)
    local top = camera:WorldToViewportPoint(topPos)
    local bot = camera:WorldToViewportPoint(botPos)
    if top.Z <= 0 or bot.Z <= 0 then
        return HideGui(o)
    end

    local h = math.abs(bot.Y - top.Y)
    local w = h * 0.6
    local cx = (top.X + bot.X) / 2
    local x, y = cx - w / 2, math.min(top.Y, bot.Y)

    o.Box.Visible = S.Box
    if S.Box then
        o.Box.Position = UDim2.fromOffset(x, y)
        o.Box.Size = UDim2.fromOffset(w, h)
        o.BoxStroke.Color = S.BoxColor
    end

    o.HealthTrack.Visible = S.Health
    if S.Health then
        local ratio = math.clamp(hum.Health / math.max(hum.MaxHealth, 1), 0, 1)
        o.HealthTrack.Position = UDim2.fromOffset(x - 6, y)
        o.HealthTrack.Size = UDim2.fromOffset(3, h)
        o.HealthFill.Size = UDim2.fromScale(1, ratio)
        o.HealthFill.BackgroundColor3 = Color3.fromRGB(255, 70, 70):Lerp(Color3.fromRGB(70, 230, 110), ratio)
    end

    o.NameLabel.Visible = S.Name
    if S.Name then
        o.NameLabel.Position = UDim2.fromOffset(cx, y - 2)
        o.NameLabel.Text = plr.DisplayName
        o.NameLabel.TextColor3 = S.NameColor
    end

    o.DistLabel.Visible = S.Distance
    if S.Distance then
        o.DistLabel.Position = UDim2.fromOffset(cx, y + h + 2)
        o.DistLabel.Text = math.floor(dist * 0.28 + 0.5) .. "m"
        o.DistLabel.TextColor3 = S.DistanceColor
    end
end

local function AddPlayer(plr)
    if plr ~= LocalPlayer and not Objects[plr] then NewObject(plr) end
end
local function RemovePlayer(plr)
    local o = Objects[plr]
    if o then
        o.Folder:Destroy()
        o.Highlight:Destroy()
        Objects[plr] = nil
    end
end

for _, p in ipairs(Players:GetPlayers()) do AddPlayer(p) end
Connect(Players.PlayerAdded, AddPlayer)
Connect(Players.PlayerRemoving, RemovePlayer)
Connect(RunService.RenderStepped, function()
    local camera = workspace.CurrentCamera
    if not camera then return end
    for _, o in pairs(Objects) do
        local ok = pcall(UpdateObject, o, camera)
        if not ok then pcall(HideAll, o) end
    end
end)

-------------------------------------------------
-- UI
-------------------------------------------------
local Window = {IsHidden = false, IPHidden = false}
local SIZE = UDim2.new(0, 520, 0, 420)

local ScreenGui = Create("ScreenGui", {
    Name = HttpService:GenerateGUID(false),
    ResetOnSpawn = false,
    ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
    DisplayOrder = 999,
    IgnoreGuiInset = true,
}, GuiParent())

local Root = Create("Frame", {
    Size = SIZE,
    Position = UDim2.new(0.5, -SIZE.X.Offset / 2 - 100, 0.5, -SIZE.Y.Offset / 2),
    BackgroundTransparency = 1,
}, ScreenGui)

local Main = Create("Frame", {
    AnchorPoint = Vector2.new(0.5, 0.5),
    Position = UDim2.fromScale(0.5, 0.5),
    Size = UDim2.fromScale(1, 1),
    BackgroundColor3 = Theme.Background,
    BackgroundTransparency = Theme.Transparency,
    BorderSizePixel = 0,
    ClipsDescendants = true,
}, Root)
Corner(Main, 14)
local MainStroke = Stroke(Main, Theme.Accent, 1.3, 0.45)

local Blend = Create("Frame", {Size = UDim2.fromScale(1, 1), BorderSizePixel = 0, ZIndex = 0}, Main)
Create("UIGradient", {
    Rotation = 90,
    Transparency = NumberSequence.new({NumberSequenceKeypoint.new(0, 0.55), NumberSequenceKeypoint.new(1, 0.9)}),
}, Blend)

-- Top bar
local TopBar = Create("Frame", {Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Active = true, ZIndex = 5}, Main)

local Logo = Create("Frame", {Size = UDim2.fromOffset(24, 24), Position = UDim2.new(0, 14, 0.5, -12), BorderSizePixel = 0, ZIndex = 6}, TopBar)
Corner(Logo, 7)
Create("TextLabel", {
    Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = "S",
    Font = Enum.Font.GothamBold, TextSize = 14, TextColor3 = WHITE, ZIndex = 7,
}, Logo)

local Title = Create("TextLabel", {
    Size = UDim2.new(0, 200, 1, 0), Position = UDim2.new(0, 46, 0, 0), BackgroundTransparency = 1,
    RichText = true, Font = Enum.Font.GothamMedium, TextSize = 15, TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 6,
}, TopBar)

local InfoBtn = Create("TextButton", {
    AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -52, 0.5, 0),
    Size = UDim2.fromOffset(0, 26), AutomaticSize = Enum.AutomaticSize.X,
    BackgroundTransparency = 0.4, BorderSizePixel = 0, AutoButtonColor = false,
    Font = Enum.Font.Gotham, TextSize = 11, Text = "--:--:--  •  loading...", ZIndex = 6,
}, TopBar)
Corner(InfoBtn, 7)
Create("UIPadding", {PaddingLeft = UDim.new(0, 10), PaddingRight = UDim.new(0, 10)}, InfoBtn)

local ipText
local function UpdateInfo()
    local t = os.date("*t")
    InfoBtn.Text = string.format("%02d:%02d:%02d  •  %s", t.hour, t.min, t.sec, Window.IPHidden and "IP hidden" or (ipText or "loading..."))
end
InfoBtn.MouseButton1Click:Connect(function()
    Window.IPHidden = not Window.IPHidden
    UpdateInfo()
end)
task.spawn(function()
    while ScreenGui.Parent do
        UpdateInfo()
        task.wait(1)
    end
end)
task.spawn(function()
    -- your own public IP, shown only on your screen
    local ok, res = pcall(function() return game:HttpGet("https://api.ipify.org") end)
    if not ok then
        ok, res = pcall(function()
            local req = request or http_request or (syn and syn.request)
            return req({Url = "https://api.ipify.org", Method = "GET"}).Body
        end)
    end
    ipText = (ok and type(res) == "string" and res:match("^[%x%.:]+$")) and res or "unknown"
    UpdateInfo()
end)

local MinBtn = Create("TextButton", {
    Size = UDim2.fromOffset(32, 28), Position = UDim2.new(1, -42, 0.5, -14),
    BackgroundTransparency = 0.4, BorderSizePixel = 0, AutoButtonColor = false,
    Font = Enum.Font.GothamBold, TextSize = 18, Text = "–", ZIndex = 6,
}, TopBar)
Corner(MinBtn, 8)

local TopDivider = Create("Frame", {Size = UDim2.new(1, -28, 0, 1), Position = UDim2.new(0, 14, 1, -1), BackgroundTransparency = 0.6, BorderSizePixel = 0}, TopBar)

-- Body: sidebar + content
local Body = Create("Frame", {Size = UDim2.new(1, 0, 1, -44), Position = UDim2.new(0, 0, 0, 44), BackgroundTransparency = 1, ZIndex = 2}, Main)
local SIDE = 120

local Sidebar = Create("Frame", {Size = UDim2.new(0, SIDE, 1, 0), BackgroundTransparency = 1}, Body)
Create("UIPadding", {PaddingTop = UDim.new(0, 12), PaddingLeft = UDim.new(0, 12), PaddingRight = UDim.new(0, 8)}, Sidebar)
local TabBtn = Create("TextButton", {
    Size = UDim2.new(1, 0, 0, 32), BorderSizePixel = 0, AutoButtonColor = false,
    Font = Enum.Font.Gotham, TextSize = 13, Text = "ESP", TextXAlignment = Enum.TextXAlignment.Left,
}, Sidebar)
Create("UIPadding", {PaddingLeft = UDim.new(0, 12)}, TabBtn)
Corner(TabBtn, 8)

local SideDivider = Create("Frame", {Size = UDim2.new(0, 1, 1, -16), Position = UDim2.new(0, SIDE, 0, 8), BackgroundTransparency = 0.6, BorderSizePixel = 0}, Body)

local Right = Create("Frame", {Size = UDim2.new(1, -(SIDE + 14), 1, 0), Position = UDim2.new(0, SIDE + 14, 0, 0), BackgroundTransparency = 1}, Body)
local TabTitle = Create("TextLabel", {
    Size = UDim2.new(1, -20, 0, 28), Position = UDim2.new(0, 8, 0, 8), BackgroundTransparency = 1, Text = "ESP",
    Font = Enum.Font.GothamMedium, TextSize = 16, TextXAlignment = Enum.TextXAlignment.Left,
}, Right)

local Scroll = Create("ScrollingFrame", {
    Size = UDim2.new(1, -16, 1, -44), Position = UDim2.new(0, 8, 0, 40),
    BackgroundTransparency = 1, BorderSizePixel = 0, ScrollBarThickness = 3, ScrollBarImageTransparency = 0.35,
    CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y,
}, Right)
Create("UIListLayout", {Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder}, Scroll)
Create("UIPadding", {PaddingTop = UDim.new(0, 4), PaddingBottom = UDim.new(0, 14), PaddingRight = UDim.new(0, 8)}, Scroll)

-- Floating reopen button
local OpenBtn = Create("TextButton", {
    Size = UDim2.fromOffset(46, 46), Position = UDim2.new(1, -68, 1, -68),
    BackgroundTransparency = 0.2, BorderSizePixel = 0, AutoButtonColor = false,
    Font = Enum.Font.GothamBold, TextSize = 20, Text = "☰", Visible = false, ZIndex = 100,
}, ScreenGui)
Corner(OpenBtn, 12)
local OpenStroke = Stroke(OpenBtn, Theme.Accent, 1.4, 0.35)

Bind(function(t)
    Main.BackgroundColor3 = t.Background
    if not Window.IsHidden then Main.BackgroundTransparency = t.Transparency end
    MainStroke.Color = Mix(t.Background, t.Accent, 0.5)
    Blend.BackgroundColor3 = Mix(t.Background, t.Accent, 0.16)
    Logo.BackgroundColor3 = t.Accent
    Title.Text = string.format('sqservices.me  <font color="%s">•  ESP</font>', Hex(t.SubText))
    Title.TextColor3 = t.Text
    InfoBtn.BackgroundColor3 = ElementColor(t)
    InfoBtn.TextColor3 = t.SubText
    MinBtn.BackgroundColor3 = ElementColor(t)
    MinBtn.TextColor3 = t.Text
    TopDivider.BackgroundColor3 = Mix(t.Background, t.Accent, 0.6)
    SideDivider.BackgroundColor3 = Mix(t.Background, t.Accent, 0.6)
    TabBtn.BackgroundColor3 = Mix(t.Background, t.Accent, 0.35)
    TabBtn.BackgroundTransparency = 0.3
    TabBtn.TextColor3 = t.Text
    TabTitle.TextColor3 = t.Text
    Scroll.ScrollBarImageColor3 = t.Accent
    OpenBtn.BackgroundColor3 = Mix(t.Background, t.Accent, 0.2)
    OpenBtn.TextColor3 = t.Text
    OpenStroke.Color = t.Accent
end)

-- Hide / show (same behavior as before)
local function HideUI()
    if Window.IsHidden then return end
    Window.IsHidden = true
    Tween(Main, {Size = UDim2.fromScale(0.92, 0.92), BackgroundTransparency = 0.6}, 0.22)
    task.delay(0.14, function()
        if not Window.IsHidden then return end
        Root.Visible = false
        OpenBtn.Visible = true
        OpenBtn.BackgroundTransparency = 1
        OpenBtn.TextTransparency = 1
        Tween(OpenBtn, {BackgroundTransparency = 0.2, TextTransparency = 0}, 0.2)
    end)
end
local function ShowUI()
    if not Window.IsHidden then return end
    Window.IsHidden = false
    OpenBtn.Visible = false
    Root.Visible = true
    Main.BackgroundTransparency = 0.6
    Main.Size = UDim2.fromScale(0.92, 0.92)
    Tween(Main, {Size = UDim2.fromScale(1, 1), BackgroundTransparency = Theme.Transparency}, 0.3, Enum.EasingStyle.Back)
end
MinBtn.MouseEnter:Connect(function() Tween(MinBtn, {BackgroundTransparency = 0.15}, 0.15) end)
MinBtn.MouseLeave:Connect(function() Tween(MinBtn, {BackgroundTransparency = 0.4}, 0.15) end)
MinBtn.MouseButton1Click:Connect(HideUI)
OpenBtn.MouseButton1Click:Connect(ShowUI)
Connect(UserInputService.InputBegan, function(input, gp)
    if gp then return end
    if input.KeyCode == Enum.KeyCode.RightShift then
        if Window.IsHidden then ShowUI() else HideUI() end
    end
end)

-- Dragging
do
    local dragging, startInput, startPos
    TopBar.InputBegan:Connect(function(input)
        if IsPress(input) then
            dragging, startInput, startPos = true, input.Position, Root.Position
        end
    end)
    TopBar.InputEnded:Connect(function(input)
        if IsPress(input) then dragging = false end
    end)
    Connect(UserInputService.InputChanged, function(input)
        if dragging and IsMove(input) then
            local d = input.Position - startInput
            Root.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
        end
    end)
end

-------------------------------------------------
-- UI ELEMENTS
-------------------------------------------------
local function AddSection(text)
    local l = Create("TextLabel", {
        Size = UDim2.new(1, 0, 0, 20), BackgroundTransparency = 1, Text = string.upper(text),
        Font = Enum.Font.GothamBold, TextSize = 10, TextXAlignment = Enum.TextXAlignment.Left,
    }, Scroll)
    Bind(function(t) l.TextColor3 = t.SubText end)
end

local function BuildSlider(parent, o)
    local name, min, max = o.Name, o.Min, o.Max
    local inc, suffix = o.Increment or 1, o.Suffix or ""
    local callback = o.Callback
    local value = math.clamp(o.Default or min, min, max)

    local Holder = Create("Frame", {Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1}, parent)
    local Label = Create("TextLabel", {Size = UDim2.new(1, 0, 0, 16), BackgroundTransparency = 1, Font = Enum.Font.Gotham, TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left}, Holder)
    local Track = Create("Frame", {Size = UDim2.new(1, -14, 0, 4), Position = UDim2.new(0, 7, 0, 29), BackgroundTransparency = 0.2, BorderSizePixel = 0}, Holder)
    Corner(Track, 2)
    local Fill = Create("Frame", {Size = UDim2.new(0, 0, 1, 0), BorderSizePixel = 0}, Track)
    Corner(Fill, 2)
    local Knob = Create("Frame", {Size = UDim2.fromOffset(14, 14), AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = Color3.fromRGB(235, 242, 255), BorderSizePixel = 0, ZIndex = 2}, Track)
    Corner(Knob, 7)
    local Hit = Create("Frame", {Size = UDim2.new(1, 0, 0, 24), Position = UDim2.new(0, 0, 0, 18), BackgroundTransparency = 1, Active = true, ZIndex = 3}, Holder)

    local function Render(animate)
        local pct = (max - min) == 0 and 0 or (value - min) / (max - min)
        Label.Text = name .. "  •  " .. tostring(value) .. suffix
        if animate then
            Tween(Fill, {Size = UDim2.new(pct, 0, 1, 0)}, 0.08)
            Tween(Knob, {Position = UDim2.new(pct, 0, 0.5, 0)}, 0.08)
        else
            Fill.Size = UDim2.new(pct, 0, 1, 0)
            Knob.Position = UDim2.new(pct, 0, 0.5, 0)
        end
    end
    local function Snap(v)
        v = math.floor((v - min) / inc + 0.5) * inc + min
        return math.clamp(math.floor(v * 1000 + 0.5) / 1000, min, max)
    end

    local dragging = false
    local function Update(input)
        local rel = math.clamp((input.Position.X - Track.AbsolutePosition.X) / math.max(Track.AbsoluteSize.X, 1), 0, 1)
        local new = Snap(min + (max - min) * rel)
        if new ~= value then
            value = new
            Render(true)
            callback(value)
        end
    end
    Hit.InputBegan:Connect(function(input) if IsPress(input) then dragging = true Update(input) end end)
    Connect(UserInputService.InputChanged, function(input) if dragging and IsMove(input) then Update(input) end end)
    Connect(UserInputService.InputEnded, function(input) if IsPress(input) then dragging = false end end)

    Bind(function(t)
        Label.TextColor3 = t.SubText
        Track.BackgroundColor3 = ElementColor(t)
        Fill.BackgroundColor3 = t.Accent
    end)
    Render(false)
    return Holder, {
        Set = function(v, silent) value = Snap(v) Render(false) if not silent then callback(value) end end,
        Get = function() return value end,
    }
end

local function AddSlider(o) return BuildSlider(Scroll, o) end

local function AddToggle(name, default, callback)
    local state = default
    local Holder = Create("Frame", {Size = UDim2.new(1, 0, 0, 32), BackgroundTransparency = 1}, Scroll)
    local Label = Create("TextLabel", {Size = UDim2.new(1, -56, 1, 0), BackgroundTransparency = 1, Text = name, Font = Enum.Font.Gotham, TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left}, Holder)
    local Track = Create("Frame", {Size = UDim2.fromOffset(42, 22), Position = UDim2.new(1, -50, 0.5, -11), BackgroundTransparency = 0.1, BorderSizePixel = 0, Active = true}, Holder)
    Corner(Track, 11)
    local Knob = Create("Frame", {Size = UDim2.fromOffset(16, 16), BackgroundColor3 = Color3.fromRGB(240, 245, 255), BorderSizePixel = 0}, Track)
    Corner(Knob, 8)

    local function Paint(animate)
        local t = Theme
        local color = state and t.Accent or Mix(ElementColor(t), WHITE, 0.06)
        local pos = state and UDim2.new(1, -19, 0.5, -8) or UDim2.new(0, 3, 0.5, -8)
        if animate then
            Tween(Track, {BackgroundColor3 = color}, 0.2)
            Tween(Knob, {Position = pos}, 0.2)
        else
            Track.BackgroundColor3, Knob.Position = color, pos
        end
    end
    Bind(function(t) Label.TextColor3 = t.Text Paint(false) end)

    local api = {}
    function api.Set(v, silent)
        state = v and true or false
        Paint(true)
        if not silent then callback(state) end
    end
    Track.InputBegan:Connect(function(input) if IsPress(input) then api.Set(not state) end end)
    return api
end

local function AddColorPicker(name, default, callback)
    local color = default
    local h, s, v = color:ToHSV()
    local expanded = false

    local Holder = Create("Frame", {Size = UDim2.new(1, 0, 0, 32), BackgroundTransparency = 1, ClipsDescendants = true}, Scroll)
    local Header = Create("TextButton", {Size = UDim2.new(1, 0, 0, 32), BackgroundTransparency = 1, Text = "", AutoButtonColor = false}, Holder)
    local Label = Create("TextLabel", {Size = UDim2.new(1, -70, 1, 0), BackgroundTransparency = 1, Text = name, Font = Enum.Font.Gotham, TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left}, Header)
    local Swatch = Create("Frame", {Size = UDim2.fromOffset(42, 22), Position = UDim2.new(1, -50, 0.5, -11), BorderSizePixel = 0, BackgroundColor3 = color}, Header)
    Corner(Swatch, 7)
    local SwStroke = Stroke(Swatch, WHITE, 1, 0.5)

    local Bdy = Create("Frame", {Size = UDim2.new(1, 0, 0, 132), Position = UDim2.new(0, 0, 0, 34), BackgroundTransparency = 1}, Holder)
    Create("UIListLayout", {SortOrder = Enum.SortOrder.LayoutOrder}, Bdy)

    local function Apply()
        color = Color3.fromHSV(h, s, v)
        Swatch.BackgroundColor3 = color
        callback(color)
    end
    BuildSlider(Bdy, {Name = "Hue", Min = 0, Max = 360, Default = math.floor(h * 360 + .5), Callback = function(x) h = x / 360 Apply() end})
    BuildSlider(Bdy, {Name = "Saturation", Min = 0, Max = 100, Default = math.floor(s * 100 + .5), Callback = function(x) s = x / 100 Apply() end})
    BuildSlider(Bdy, {Name = "Brightness", Min = 0, Max = 100, Default = math.floor(v * 100 + .5), Callback = function(x) v = x / 100 Apply() end})

    Header.MouseButton1Click:Connect(function()
        expanded = not expanded
        Tween(Holder, {Size = UDim2.new(1, 0, 0, expanded and 170 or 32)}, 0.25)
    end)
    Bind(function(t)
        Label.TextColor3 = t.Text
        SwStroke.Color = Mix(t.Background, t.Accent, 0.6)
    end)
end

-------------------------------------------------
-- ESP PREVIEW PANEL (3D model)
-------------------------------------------------
local ToggleAPI = {}
local PreviewPaint

local function CloneCharacter(char)
    if not char then return nil end
    local old = char.Archivable
    char.Archivable = true
    local ok, clone = pcall(function() return char:Clone() end)
    char.Archivable = old
    if not ok or not clone then return nil end
    for _, d in ipairs(clone:GetDescendants()) do
        if d:IsA("BaseScript") or d:IsA("Sound") or d:IsA("ForceField") or d:IsA("Humanoid") then
            d:Destroy()
        elseif d:IsA("BasePart") then
            d.Anchored = true
        end
    end
    return clone
end

local function BuildDummy()
    local m = Instance.new("Model")
    local function part(n, size, pos, color)
        Create("Part", {Name = n, Size = size, Position = pos, Color = color, Anchored = true, TopSurface = Enum.SurfaceType.Smooth, BottomSurface = Enum.SurfaceType.Smooth}, m)
    end
    local skin, shirt, pants = Color3.fromRGB(245, 205, 150), Color3.fromRGB(40, 40, 48), Color3.fromRGB(25, 25, 30)
    part("Torso", Vector3.new(2, 2, 1), Vector3.new(0, 3, 0), shirt)
    part("Head", Vector3.new(1.2, 1.2, 1.2), Vector3.new(0, 4.6, 0), skin)
    part("LeftArm", Vector3.new(1, 2, 1), Vector3.new(-1.5, 3, 0), shirt)
    part("RightArm", Vector3.new(1, 2, 1), Vector3.new(1.5, 3, 0), shirt)
    part("LeftLeg", Vector3.new(1, 2, 1), Vector3.new(-0.5, 1, 0), pants)
    part("RightLeg", Vector3.new(1, 2, 1), Vector3.new(0.5, 1, 0), pants)
    m.PrimaryPart = m.Torso
    return m
end

do
    local PW, PH = 220, 330
    local SW, SH = PW - 24, PH - 64
    local FILL = 0.62

    local Panel = Create("Frame", {
        Size = UDim2.fromOffset(PW, PH), Position = UDim2.new(1, 10, 0, 0),
        BorderSizePixel = 0, ClipsDescendants = true,
    }, Root)
    Corner(Panel, 14)
    local PStroke = Stroke(Panel, WHITE, 1.3, 0.45)
    local PTitle = Create("TextLabel", {Size = UDim2.new(1, -24, 0, 18), Position = UDim2.new(0, 14, 0, 12), BackgroundTransparency = 1, Text = "ESP Preview", Font = Enum.Font.GothamBold, TextSize = 13, TextXAlignment = Enum.TextXAlignment.Left}, Panel)
    local PSub = Create("TextLabel", {Size = UDim2.new(1, -24, 0, 14), Position = UDim2.new(0, 14, 0, 30), BackgroundTransparency = 1, Text = "Tap an element to toggle it", Font = Enum.Font.Gotham, TextSize = 10, TextXAlignment = Enum.TextXAlignment.Left}, Panel)

    local Stage = Create("Frame", {Size = UDim2.fromOffset(SW, SH), Position = UDim2.fromOffset(12, 52), BackgroundTransparency = 0.35, BorderSizePixel = 0, ClipsDescendants = true}, Panel)
    Corner(Stage, 10)

    local Viewport = Create("ViewportFrame", {
        Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1,
        Ambient = Color3.fromRGB(175, 175, 190), LightColor = WHITE, LightDirection = Vector3.new(-0.4, -0.6, 0.7),
    }, Stage)
    local Cam = Create("Camera", {FieldOfView = 30}, Viewport)
    Viewport.CurrentCamera = Cam

    local boxW, boxH = 100, math.floor(SH * FILL)
    local BoxBtn = Create("TextButton", {AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), BackgroundTransparency = 1, Text = "", AutoButtonColor = false, ZIndex = 5}, Stage)
    local BoxStroke = Stroke(BoxBtn, WHITE, 1.5, 0)
    local HealthBtn = Create("TextButton", {AnchorPoint = Vector2.new(0.5, 0.5), BackgroundTransparency = 1, Text = "", AutoButtonColor = false, ZIndex = 5}, Stage)
    local HTrack = Create("Frame", {AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0), Size = UDim2.new(0, 3, 1, 0), BackgroundColor3 = BLACK, BackgroundTransparency = 0.45, BorderSizePixel = 0}, HealthBtn)
    local HFill = Create("Frame", {AnchorPoint = Vector2.new(0, 1), Position = UDim2.fromScale(0, 1), Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(70, 230, 110), BorderSizePixel = 0}, HTrack)
    local NameBtn = Create("TextButton", {AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.fromOffset(150, 14), BackgroundTransparency = 1, AutoButtonColor = false, Text = LocalPlayer.DisplayName, Font = Enum.Font.GothamMedium, TextSize = 11, ZIndex = 5}, Stage)
    local DistBtn = Create("TextButton", {AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.fromOffset(150, 14), BackgroundTransparency = 1, AutoButtonColor = false, Text = "24m", Font = Enum.Font.Gotham, TextSize = 11, ZIndex = 5}, Stage)

    local function Layout()
        BoxBtn.Size = UDim2.fromOffset(boxW, boxH)
        HealthBtn.Size = UDim2.fromOffset(10, boxH)
        HealthBtn.Position = UDim2.new(0, SW / 2 - boxW / 2 - 8, 0.5, 0)
        NameBtn.Position = UDim2.new(0, SW / 2, 0.5, boxH / 2 + 4)
        DistBtn.Position = UDim2.new(0, SW / 2, 0.5, boxH / 2 + 18)
    end

    function PreviewPaint(t)
        t = t or Theme
        Panel.BackgroundColor3, Panel.BackgroundTransparency = t.Background, t.Transparency
        PStroke.Color = Mix(t.Background, t.Accent, 0.5)
        PTitle.TextColor3, PSub.TextColor3 = t.Text, t.SubText
        Stage.BackgroundColor3 = Mix(t.Background, BLACK, 0.35)

        BoxStroke.Color = S.BoxColor
        BoxStroke.Transparency = S.Box and 0 or 0.88
        NameBtn.TextColor3 = S.NameColor
        NameBtn.TextTransparency = S.Name and 0 or 0.85
        NameBtn.TextStrokeTransparency = S.Name and 0.5 or 1
        DistBtn.TextColor3 = S.DistanceColor
        DistBtn.TextTransparency = S.Distance and 0 or 0.85
        DistBtn.TextStrokeTransparency = S.Distance and 0.5 or 1
        HFill.BackgroundTransparency = S.Health and 0 or 0.88
        HTrack.BackgroundTransparency = S.Health and 0.45 or 0.92
    end
    Bind(PreviewPaint)

    local function Tap(key)
        S[key] = not S[key]
        if ToggleAPI[key] then ToggleAPI[key].Set(S[key], true) end
        PreviewPaint()
    end
    BoxBtn.MouseButton1Click:Connect(function() Tap("Box") end)
    NameBtn.MouseButton1Click:Connect(function() Tap("Name") end)
    DistBtn.MouseButton1Click:Connect(function() Tap("Distance") end)
    HealthBtn.MouseButton1Click:Connect(function() Tap("Health") end)

    local current, pivotOffset
    local function Mount(model)
        model.Parent = Viewport
        local bb, size = model:GetBoundingBox()
        if size.Y < 0.5 then
            model:Destroy()
            model = BuildDummy()
            model.Parent = Viewport
            bb, size = model:GetBoundingBox()
        end
        current = model
        pivotOffset = bb:ToObjectSpace(model:GetPivot())
        local dist = size.Y / FILL / (2 * math.tan(math.rad(Cam.FieldOfView / 2)))
        Cam.CFrame = CFrame.lookAt(Vector3.new(0, 0, -dist), Vector3.zero)
        boxW = math.clamp(math.floor(boxH * (size.X / size.Y) * 1.02), 40, SW - 50)
        Layout()
    end
    local ok = pcall(function() Mount(CloneCharacter(LocalPlayer.Character) or BuildDummy()) end)
    if not ok then
        if current then current:Destroy() end
        pcall(function() Mount(BuildDummy()) end)
    end

    Connect(RunService.RenderStepped, function()
        if current and Root.Visible then
            current:PivotTo(CFrame.Angles(0, math.sin(os.clock() * 1.2) * 0.55, 0) * pivotOffset)
        end
    end)
    Layout()
end

-------------------------------------------------
-- BUILD THE ESP TAB
-------------------------------------------------
AddSection("General")
ToggleAPI.Enabled = AddToggle("Enable ESP", S.Enabled, function(v) S.Enabled = v end)
ToggleAPI.TeamCheck = AddToggle("Team Check (hide teammates)", S.TeamCheck, function(v) S.TeamCheck = v end)
AddSlider({Name = "Max Distance", Min = 100, Max = 5000, Increment = 50, Default = S.MaxDistance, Suffix = " studs", Callback = function(v) S.MaxDistance = v end})

AddSection("Overlay")
ToggleAPI.Box = AddToggle("Box ESP", S.Box, function(v) S.Box = v PreviewPaint() end)
ToggleAPI.Name = AddToggle("Name ESP", S.Name, function(v) S.Name = v PreviewPaint() end)
ToggleAPI.Distance = AddToggle("Distance ESP", S.Distance, function(v) S.Distance = v PreviewPaint() end)
ToggleAPI.Health = AddToggle("Health Bar", S.Health, function(v) S.Health = v PreviewPaint() end)
AddColorPicker("Box Color", S.BoxColor, function(c) S.BoxColor = c PreviewPaint() end)
AddColorPicker("Name Color", S.NameColor, function(c) S.NameColor = c PreviewPaint() end)

AddSection("Body")
ToggleAPI.Chams = AddToggle("Body Chams (see through walls)", S.Chams, function(v) S.Chams = v end)
AddColorPicker("Chams Fill Color", S.ChamsFill, function(c) S.ChamsFill = c end)
AddColorPicker("Chams Outline Color", S.ChamsOutline, function(c) S.ChamsOutline = c end)
AddSlider({Name = "Chams Fill Transparency", Min = 0, Max = 100, Default = math.floor(S.ChamsFillTransparency * 100 + .5), Suffix = "%", Callback = function(v) S.ChamsFillTransparency = v / 100 end})

AddSection("UI")
AddColorPicker("UI Color", Theme.Accent, function(c) Theme.Accent = c Refresh() end)
AddSlider({Name = "UI Transparency", Min = 0, Max = 80, Default = math.floor(Theme.Transparency * 100 + .5), Suffix = "%", Callback = function(v) Theme.Transparency = v / 100 Refresh() end})

-- open animation
Main.BackgroundTransparency = 1
Main.Size = UDim2.fromScale(0.86, 0.86)
Tween(Main, {Size = UDim2.fromScale(1, 1), BackgroundTransparency = Theme.Transparency}, 0.4, Enum.EasingStyle.Back)

-------------------------------------------------
-- PUBLIC
-------------------------------------------------
local API = {Settings = S, Theme = Theme}
API.Window = {
    Show = ShowUI,
    Hide = HideUI,
    SetAccent = function(c) Theme.Accent = c Refresh() end,
    SetBackground = function(c) Theme.Background = c Refresh() end,
    SetTransparency = function(v) Theme.Transparency = math.clamp(v, 0, 0.95) Refresh() end,
}
function API.Destroy()
    for _, c in ipairs(Conns) do pcall(function() c:Disconnect() end) end
    for plr in pairs(Objects) do RemovePlayer(plr) end
    pcall(function() EspGui:Destroy() end)
    pcall(function() ChamFolder:Destroy() end)
    pcall(function() ScreenGui:Destroy() end)
end

pcall(function()
    local g = (getgenv and getgenv()) or _G
    g.sqservicesESP = API
end)

return API
