# reminder-toast.ps1
# 开机提醒弹窗：读取本地面试 agent 的日程与今日练习，右下角弹出悬浮提示。
# 由 start-agent.cmd 启动；需用 powershell.exe（5.1，STA）运行以确保 WPF 正常。
$ErrorActionPreference = "SilentlyContinue"
$base = "http://localhost:3000"

# 1) 等待服务就绪（最长 60 秒）
$ready = $false
$waited = 0
while ($waited -lt 60) {
  try {
    $null = Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 2
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 2
    $waited += 2
  }
}
if (-not $ready) { exit }

# 2) 拉取数据：明天面试 + 今日练习计划
$lines = New-Object System.Collections.Generic.List[string]
try {
  $schedule = Invoke-RestMethod -Uri "$base/api/schedule" -TimeoutSec 5
  $due = @($schedule.dueTomorrow)
  if ($due.Count -gt 0) {
    $lines.Add("⏰ 明天有面试，记得准备")
    foreach ($d in $due) { $lines.Add("   · $($d.company) · $($d.role)") }
  } else {
    $lines.Add("✅ 明天暂无面试安排")
  }
} catch {
  $lines.Add("（日程读取失败）")
}

try {
  $practice = Invoke-RestMethod -Uri "$base/api/practice/today" -TimeoutSec 5
  $plan = @($practice.plan)
  if ($plan.Count -gt 0) {
    $lines.Add("")
    $lines.Add("🎯 今日练习计划")
    foreach ($p in $plan) { $lines.Add("   · $($p.topic)") }
  } else {
    $lines.Add("")
    $lines.Add("🎯 完成一场模拟后生成你的专属练习计划")
  }
} catch {}

$content = $lines -join "`r`n"

# 3) WPF 悬浮弹窗（右下角，自动关闭，点击打开首页）
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" Width="380" SizeToContent="Height"
        WindowStartupLocation="Manual" Cursor="Hand">
  <Border x:Name="Card" CornerRadius="12" Background="#FF111827" Padding="16"
          BorderBrush="#FF374151" BorderThickness="1">
    <StackPanel>
      <TextBlock x:Name="Title" Text="Personal AI Interview Agent"
                 FontSize="15" FontWeight="Bold" Foreground="White"/>
      <TextBlock x:Name="Body" FontSize="13" Foreground="#FFE5E7EB"
                 Margin="0,8,0,0" TextWrapping="Wrap"/>
      <TextBlock Text="点击查看详情" FontSize="11" Foreground="#FF9CA3AF" Margin="0,10,0,0"/>
    </StackPanel>
  </Border>
</Window>
"@

try {
  $xml = [xml]$xaml
  $reader = [System.Xml.XmlNodeReader]::new($xml)
  $window = [System.Windows.Markup.XamlReader]::Load($reader)
  $body = $window.FindName("Body")
  $body.Text = $content

  # 定位右下角
  $window.Add_Loaded({
    $sw = [System.Windows.SystemParameters]::PrimaryScreenWidth
    $sh = [System.Windows.SystemParameters]::PrimaryScreenHeight
    $window.Left = $sw - $window.ActualWidth - 24
    $window.Top = $sh - $window.ActualHeight - 90
  })

  # 点击打开首页
  $window.Add_MouseLeftButtonUp({
    Start-Process "http://localhost:3000"
    $window.Close()
  })

  # 12 秒后自动关闭
  $timer = [System.Windows.Threading.DispatcherTimer]::new()
  $timer.Interval = [TimeSpan]::FromSeconds(12)
  $timer.Add_Tick({ $window.Close() })
  $timer.Start()

  $window.ShowDialog()
} catch {
  # WPF 失败时退化为直接打开浏览器
  Start-Process "http://localhost:3000"
}
