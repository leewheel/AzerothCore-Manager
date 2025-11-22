import React, { useState } from 'react';
import { Copy, FileCode, Info } from 'lucide-react';

// --- C# Source Code Data ---

const README_TEXT = `=== 项目构建指南 (WinForms) ===

1. 创建项目:
   打开 Visual Studio, 新建 "Windows Forms App (.NET Framework)" 项目。
   * 建议选择 .NET Framework 4.7.2 或 4.8 以保证最大兼容性。

2. 安装依赖 (NuGet):
   在 "解决方案资源管理器" 右键项目 -> "管理 NuGet 程序包"。
   搜索并安装: 
   - MySql.Data (用于连接数据库)

3. 实现"单文件"运行 (关键步骤!):
   你的需求是"根目录只有这个小工具"，但默认编译会产生 MySql.Data.dll 等一堆文件。
   为了将所有 DLL 合并进一个 EXE：
   - 在 NuGet 管理器中搜索并安装: Costura.Fody
   - 安装完成后，重新编译项目。Costura 会自动将 MySql.Data.dll 嵌入到你的主程序中。
   - 最后去 bin/Debug 或 bin/Release 目录下，只需要拿走那个 .exe 文件即可。

4. 添加嵌入资源:
   - 找到你的 authserver.exe 和 worldserver.exe。
   - 项目 "属性" -> "资源" -> 拖入这两个文件。
   - 确保资源名称为 "authserver" 和 "worldserver"。
   - 代码逻辑会在程序启动时检测并自动释放这两个文件。

5. 创建类文件:
   - SRP6.cs (复制右侧代码)
   - MainForm.cs (复制右侧代码)
   - MainForm.Designer.cs (复制右侧代码)

6. 运行环境:
   确保运行该工具的机器上安装了对应版本的 .NET Framework。
`;

const SRP6_CS = `using System;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using System.Linq;

namespace AzerothCoreManager
{
    public static class SRP6
    {
        // AzerothCore / TrinityCore 标准 SRP6 常量
        public static readonly BigInteger N = BigInteger.Parse("0894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7", System.Globalization.NumberStyles.HexNumber);
        public static readonly BigInteger g = 7;

        /// <summary>
        /// 生成注册所需的 Salt 和 Verifier
        /// 对应 C++: Acore::Crypto::SRP6::MakeRegistrationData
        /// </summary>
        public static void MakeRegistrationData(string username, string password, out byte[] salt, out byte[] verifier)
        {
            // 1. 用户名密码转大写
            username = username.ToUpper();
            password = password.ToUpper();

            // 2. 生成 32 字节随机 Salt
            salt = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(salt);
            }

            // 3. 计算 h1 = SHA1(USERNAME : PASSWORD)
            byte[] h1;
            using (var sha1 = SHA1.Create())
            {
                string userPass = $"{username}:{password}";
                h1 = sha1.ComputeHash(Encoding.UTF8.GetBytes(userPass));
            }

            // 4. 计算 h2 = SHA1(salt | h1)
            byte[] h2Input = new byte[salt.Length + h1.Length];
            Buffer.BlockCopy(salt, 0, h2Input, 0, salt.Length);
            Buffer.BlockCopy(h1, 0, h2Input, salt.Length, h1.Length);

            byte[] h2;
            using (var sha1 = SHA1.Create())
            {
                h2 = sha1.ComputeHash(h2Input);
            }

            // 5. 将 h2 转为 BigInteger x (Little Endian)
            // 注意：C# BigInteger 构造函数需要 Little Endian 字节序
            // 且如果最高位为1，会被视为负数，所以需要在最后补 0x00 以确保是正数
            Array.Reverse(h2); // SHA1 结果通常视为大端，这里翻转为小端
            BigInteger x = new BigInteger(h2, true); // true 表示无符号 (unsigned)，防止被识别为负数

            // 6. 计算 verifier v = g^x % N
            BigInteger v = BigInteger.ModPow(g, x, N);

            // 7. 输出 verifier 字节数组 (需要保持 32 字节长度)
            byte[] vBytes = v.ToByteArray();
            
            // BigInteger.ToByteArray() 是 Little Endian。如果末尾有符号位0x00需要去掉，或者不足32位要补0
            // AzerothCore 数据库通常存储 binary(32)，这里我们尽量标准化输出
            if (vBytes.Length > 32)
            {
                // 截断多余的符号位
                verifier = new byte[32];
                Array.Copy(vBytes, 0, verifier, 0, 32); 
            }
            else if (vBytes.Length < 32)
            {
                // 补齐
                verifier = new byte[32];
                Array.Copy(vBytes, 0, verifier, 0, vBytes.Length);
            }
            else
            {
                verifier = vBytes;
            }
        }
    }
}`;

const MAINFORM_CS = `using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using MySql.Data.MySqlClient; // 需要 NuGet 安装 MySql.Data

namespace AzerothCoreManager
{
    public partial class MainForm : Form
    {
        // 数据库连接配置 (根据你的 mysql.bat 配置修改)
        private const string CONN_STR = "Server=127.0.0.1;Port=3306;Database=acore_auth;Uid=root;Pwd=password;";
        
        public MainForm()
        {
            InitializeComponent();
            CheckAndReleaseResources();
        }

        // 功能 1: 释放集成的 exe
        private void CheckAndReleaseResources()
        {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            
            // 释放 AuthServer
            if (!File.Exists(Path.Combine(root, "authserver.exe")))
            {
                try 
                {
                    // 注意: 需要在项目资源中添加 authserver.exe 并命名为 authserver
                    File.WriteAllBytes(Path.Combine(root, "authserver.exe"), Properties.Resources.authserver);
                    Log("Released authserver.exe");
                }
                catch { Log("Resource 'authserver' not found. skipped."); }
            }

            // 释放 WorldServer
            if (!File.Exists(Path.Combine(root, "worldserver.exe")))
            {
                try
                {
                    File.WriteAllBytes(Path.Combine(root, "worldserver.exe"), Properties.Resources.worldserver);
                    Log("Released worldserver.exe");
                }
                catch { Log("Resource 'worldserver' not found. skipped."); }
            }
        }

        // 功能 3: 启动流程
        private async void btnStart_Click(object sender, EventArgs e)
        {
            btnStart.Enabled = false;
            Log("正在执行 mysql.bat...");
            
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c mysql.bat");
                psi.WindowStyle = ProcessWindowStyle.Minimized; // 可选：隐藏黑框
                Process.Start(psi);
            }
            catch(Exception ex)
            {
                Log("无法启动 mysql.bat: " + ex.Message);
                btnStart.Enabled = true;
                return;
            }

            Log("等待 MySQL 启动...");

            // 循环检测 MySQL 端口或进程
            bool mysqlReady = await Task.Run(() =>
            {
                for (int i = 0; i < 30; i++)
                {
                    if (Process.GetProcessesByName("mysqld").Length > 0) return true;
                    Thread.Sleep(1000);
                }
                return false;
            });

            if (!mysqlReady)
            {
                MessageBox.Show("MySQL 启动超时或失败，请检查日志。");
                btnStart.Enabled = true;
                return;
            }

            Log("MySQL 已运行。正在启动 AuthServer...");
            StartServerProcess("authserver.exe");
            
            await Task.Delay(2000); 

            Log("正在启动 WorldServer...");
            StartServerProcess("worldserver.exe");

            Log("所有服务启动指令已发送。");
            btnStart.Enabled = true;
        }

        private void StartServerProcess(string fileName)
        {
            if (File.Exists(fileName))
            {
                Process.Start(new ProcessStartInfo(fileName) { UseShellExecute = true });
            }
            else
            {
                Log($"文件丢失: {fileName}");
            }
        }

        // 功能 2 & 4: 状态监控 (Timer Tick 事件)
        private void timerMonitor_Tick(object sender, EventArgs e)
        {
            UpdateServiceStatus("mysqld", lblMysqlStatus, lblMysqlMem);
            UpdateServiceStatus("authserver", lblAuthStatus, lblAuthMem);
            UpdateServiceStatus("worldserver", lblWorldStatus, lblWorldMem);
        }

        private void UpdateServiceStatus(string procName, Label statusLbl, Label memLbl)
        {
            var procs = Process.GetProcessesByName(procName);
            if (procs.Length > 0)
            {
                statusLbl.Text = "RUNNING";
                statusLbl.ForeColor = Color.Green;
                // 计算内存 (MB)
                long mem = procs[0].WorkingSet64 / 1024 / 1024;
                memLbl.Text = $"{mem} MB";
            }
            else
            {
                statusLbl.Text = "STOPPED";
                statusLbl.ForeColor = Color.Red;
                memLbl.Text = "0 MB";
            }
        }

        // 功能 2: 查看服务详情窗口
        private void btnViewStatus_Click(object sender, EventArgs e)
        {
            // 简单起见，直接弹出一个 MessageBox 或者一个新的 Form
            // 这里演示简单的 MessageBox，如果需要复杂窗口可以新建一个 Form 类
            string status = $"当前服务状态:\n\n";
            status += GetProcessInfoString("mysqld");
            status += GetProcessInfoString("authserver");
            status += GetProcessInfoString("worldserver");
            
            MessageBox.Show(status, "服务状态监控", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private string GetProcessInfoString(string name)
        {
            var procs = Process.GetProcessesByName(name);
            if(procs.Length > 0)
                return $"{name}: 运行中 (PID: {procs[0].Id}, Mem: {procs[0].WorkingSet64/1024/1024}MB)\n";
            return $"{name}: 未运行\n";
        }

        // 功能 5: 注册账号 (调用 SRP6)
        private void btnRegister_Click(object sender, EventArgs e)
        {
            string user = txtUsername.Text.Trim();
            string pass = txtPassword.Text.Trim();
            
            if(string.IsNullOrEmpty(user) || string.IsNullOrEmpty(pass))
            {
                MessageBox.Show("用户名或密码不能为空");
                return;
            }

            try
            {
                SRP6.MakeRegistrationData(user, pass, out byte[] salt, out byte[] verifier);

                using (var conn = new MySqlConnection(CONN_STR))
                {
                    conn.Open();
                    
                    // 1. 检查用户是否存在
                    var cmdCheck = new MySqlCommand("SELECT COUNT(*) FROM account WHERE username = @user", conn);
                    cmdCheck.Parameters.AddWithValue("@user", user.ToUpper());
                    if (Convert.ToInt32(cmdCheck.ExecuteScalar()) > 0)
                    {
                        MessageBox.Show("用户名已存在！");
                        return;
                    }

                    // 2. 插入账号
                    string sqlAcc = "INSERT INTO account (username, salt, verifier, expansion) VALUES (@user, @salt, @verifier, 2)";
                    var cmdAcc = new MySqlCommand(sqlAcc, conn);
                    cmdAcc.Parameters.AddWithValue("@user", user.ToUpper());
                    cmdAcc.Parameters.AddWithValue("@salt", salt);
                    cmdAcc.Parameters.AddWithValue("@verifier", verifier);
                    cmdAcc.ExecuteNonQuery();

                    // 获取刚插入的 ID
                    long newId = cmdAcc.LastInsertedId;

                    // 3. 设为 GM (如果选中)
                    if (chkIsGM.Checked)
                    {
                        string sqlGM = "INSERT INTO account_access (id, gmlevel, RealmID) VALUES (@id, 3, -1)";
                        var cmdGM = new MySqlCommand(sqlGM, conn);
                        cmdGM.Parameters.AddWithValue("@id", newId);
                        cmdGM.ExecuteNonQuery();
                    }

                    // 4. 初始化 Realm Characters (对应 C++ LOGIN_INS_REALM_CHARACTERS_INIT)
                    // 通常是在 realmcharacters 表里插入一条记录或者不做，视具体 AC 版本而定
                    // 这里省略，因为现代 AC 在登录时会自动处理
                    
                    MessageBox.Show($"账号 {user} 注册成功！");
                    Log($"Created account: {user}");
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("注册失败 (数据库未连接?): " + ex.Message);
            }
        }

        private void Log(string msg)
        {
            if (txtLog.InvokeRequired)
            {
                txtLog.Invoke(new Action(() => Log(msg)));
            }
            else
            {
                txtLog.AppendText($"[{DateTime.Now.ToLongTimeString()}] {msg}\r\n");
            }
        }
    }
}`;

const DESIGNER_CS = `namespace AzerothCoreManager
{
    partial class MainForm
    {
        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null)) components.Dispose();
            base.Dispose(disposing);
        }

        // Windows Form Designer generated code
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            this.btnStart = new System.Windows.Forms.Button();
            this.btnViewStatus = new System.Windows.Forms.Button();
            this.grpStatus = new System.Windows.Forms.GroupBox();
            this.lblWorldMem = new System.Windows.Forms.Label();
            this.lblAuthMem = new System.Windows.Forms.Label();
            this.lblMysqlMem = new System.Windows.Forms.Label();
            this.lblWorldStatus = new System.Windows.Forms.Label();
            this.lblAuthStatus = new System.Windows.Forms.Label();
            this.lblMysqlStatus = new System.Windows.Forms.Label();
            this.label3 = new System.Windows.Forms.Label();
            this.label2 = new System.Windows.Forms.Label();
            this.label1 = new System.Windows.Forms.Label();
            this.grpRegister = new System.Windows.Forms.GroupBox();
            this.chkIsGM = new System.Windows.Forms.CheckBox();
            this.btnRegister = new System.Windows.Forms.Button();
            this.txtPassword = new System.Windows.Forms.TextBox();
            this.label5 = new System.Windows.Forms.Label();
            this.txtUsername = new System.Windows.Forms.TextBox();
            this.label4 = new System.Windows.Forms.Label();
            this.txtLog = new System.Windows.Forms.TextBox();
            this.timerMonitor = new System.Windows.Forms.Timer(this.components);
            this.grpStatus.SuspendLayout();
            this.grpRegister.SuspendLayout();
            this.SuspendLayout();
            // 
            // btnStart
            // 
            this.btnStart.Location = new System.Drawing.Point(12, 12);
            this.btnStart.Name = "btnStart";
            this.btnStart.Size = new System.Drawing.Size(140, 40);
            this.btnStart.TabIndex = 0;
            this.btnStart.Text = "启动服务器 (MySQL+WoW)";
            this.btnStart.UseVisualStyleBackColor = true;
            this.btnStart.Click += new System.EventHandler(this.btnStart_Click);
            // 
            // btnViewStatus
            // 
            this.btnViewStatus.Location = new System.Drawing.Point(158, 12);
            this.btnViewStatus.Name = "btnViewStatus";
            this.btnViewStatus.Size = new System.Drawing.Size(100, 40);
            this.btnViewStatus.TabIndex = 1;
            this.btnViewStatus.Text = "查看服务状态";
            this.btnViewStatus.UseVisualStyleBackColor = true;
            this.btnViewStatus.Click += new System.EventHandler(this.btnViewStatus_Click);
            // 
            // grpStatus
            // 
            this.grpStatus.Controls.Add(this.lblWorldMem);
            this.grpStatus.Controls.Add(this.lblAuthMem);
            this.grpStatus.Controls.Add(this.lblMysqlMem);
            this.grpStatus.Controls.Add(this.lblWorldStatus);
            this.grpStatus.Controls.Add(this.lblAuthStatus);
            this.grpStatus.Controls.Add(this.lblMysqlStatus);
            this.grpStatus.Controls.Add(this.label3);
            this.grpStatus.Controls.Add(this.label2);
            this.grpStatus.Controls.Add(this.label1);
            this.grpStatus.Location = new System.Drawing.Point(12, 68);
            this.grpStatus.Name = "grpStatus";
            this.grpStatus.Size = new System.Drawing.Size(246, 100);
            this.grpStatus.TabIndex = 2;
            this.grpStatus.TabStop = false;
            this.grpStatus.Text = "运行监控";
            // 
            // lblWorldMem
            // 
            this.lblWorldMem.AutoSize = true;
            this.lblWorldMem.Location = new System.Drawing.Point(170, 70);
            this.lblWorldMem.Name = "lblWorldMem";
            this.lblWorldMem.Size = new System.Drawing.Size(31, 13);
            this.lblWorldMem.TabIndex = 8;
            this.lblWorldMem.Text = "0 MB";
            // 
            // lblAuthMem
            // 
            this.lblAuthMem.AutoSize = true;
            this.lblAuthMem.Location = new System.Drawing.Point(170, 45);
            this.lblAuthMem.Name = "lblAuthMem";
            this.lblAuthMem.Size = new System.Drawing.Size(31, 13);
            this.lblAuthMem.TabIndex = 7;
            this.lblAuthMem.Text = "0 MB";
            // 
            // lblMysqlMem
            // 
            this.lblMysqlMem.AutoSize = true;
            this.lblMysqlMem.Location = new System.Drawing.Point(170, 20);
            this.lblMysqlMem.Name = "lblMysqlMem";
            this.lblMysqlMem.Size = new System.Drawing.Size(31, 13);
            this.lblMysqlMem.TabIndex = 6;
            this.lblMysqlMem.Text = "0 MB";
            // 
            // lblWorldStatus
            // 
            this.lblWorldStatus.AutoSize = true;
            this.lblWorldStatus.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblWorldStatus.ForeColor = System.Drawing.Color.Red;
            this.lblWorldStatus.Location = new System.Drawing.Point(85, 70);
            this.lblWorldStatus.Name = "lblWorldStatus";
            this.lblWorldStatus.Size = new System.Drawing.Size(64, 13);
            this.lblWorldStatus.TabIndex = 5;
            this.lblWorldStatus.Text = "STOPPED";
            // 
            // lblAuthStatus
            // 
            this.lblAuthStatus.AutoSize = true;
            this.lblAuthStatus.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblAuthStatus.ForeColor = System.Drawing.Color.Red;
            this.lblAuthStatus.Location = new System.Drawing.Point(85, 45);
            this.lblAuthStatus.Name = "lblAuthStatus";
            this.lblAuthStatus.Size = new System.Drawing.Size(64, 13);
            this.lblAuthStatus.TabIndex = 4;
            this.lblAuthStatus.Text = "STOPPED";
            // 
            // lblMysqlStatus
            // 
            this.lblMysqlStatus.AutoSize = true;
            this.lblMysqlStatus.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.lblMysqlStatus.ForeColor = System.Drawing.Color.Red;
            this.lblMysqlStatus.Location = new System.Drawing.Point(85, 20);
            this.lblMysqlStatus.Name = "lblMysqlStatus";
            this.lblMysqlStatus.Size = new System.Drawing.Size(64, 13);
            this.lblMysqlStatus.TabIndex = 3;
            this.lblMysqlStatus.Text = "STOPPED";
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(7, 70);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(70, 13);
            this.label3.TabIndex = 2;
            this.label3.Text = "WorldServer:";
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(7, 45);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(63, 13);
            this.label2.TabIndex = 1;
            this.label2.Text = "AuthServer:";
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(7, 20);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(45, 13);
            this.label1.TabIndex = 0;
            this.label1.Text = "MySQL:";
            // 
            // grpRegister
            // 
            this.grpRegister.Controls.Add(this.chkIsGM);
            this.grpRegister.Controls.Add(this.btnRegister);
            this.grpRegister.Controls.Add(this.txtPassword);
            this.grpRegister.Controls.Add(this.label5);
            this.grpRegister.Controls.Add(this.txtUsername);
            this.grpRegister.Controls.Add(this.label4);
            this.grpRegister.Location = new System.Drawing.Point(12, 175);
            this.grpRegister.Name = "grpRegister";
            this.grpRegister.Size = new System.Drawing.Size(246, 130);
            this.grpRegister.TabIndex = 3;
            this.grpRegister.TabStop = false;
            this.grpRegister.Text = "账号注册 (MySQL)";
            // 
            // chkIsGM
            // 
            this.chkIsGM.AutoSize = true;
            this.chkIsGM.Location = new System.Drawing.Point(74, 75);
            this.chkIsGM.Name = "chkIsGM";
            this.chkIsGM.Size = new System.Drawing.Size(93, 17);
            this.chkIsGM.TabIndex = 5;
            this.chkIsGM.Text = "设置为 GM ?";
            this.chkIsGM.UseVisualStyleBackColor = true;
            // 
            // btnRegister
            // 
            this.btnRegister.Location = new System.Drawing.Point(74, 98);
            this.btnRegister.Name = "btnRegister";
            this.btnRegister.Size = new System.Drawing.Size(157, 25);
            this.btnRegister.TabIndex = 4;
            this.btnRegister.Text = "注册账号";
            this.btnRegister.UseVisualStyleBackColor = true;
            this.btnRegister.Click += new System.EventHandler(this.btnRegister_Click);
            // 
            // txtPassword
            // 
            this.txtPassword.Location = new System.Drawing.Point(74, 49);
            this.txtPassword.Name = "txtPassword";
            this.txtPassword.PasswordChar = '*';
            this.txtPassword.Size = new System.Drawing.Size(157, 20);
            this.txtPassword.TabIndex = 3;
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Location = new System.Drawing.Point(10, 52);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(34, 13);
            this.label5.TabIndex = 2;
            this.label5.Text = "密码:";
            // 
            // txtUsername
            // 
            this.txtUsername.Location = new System.Drawing.Point(74, 23);
            this.txtUsername.Name = "txtUsername";
            this.txtUsername.Size = new System.Drawing.Size(157, 20);
            this.txtUsername.TabIndex = 1;
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Location = new System.Drawing.Point(10, 26);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(46, 13);
            this.label4.TabIndex = 0;
            this.label4.Text = "用户名:";
            // 
            // txtLog
            // 
            this.txtLog.BackColor = System.Drawing.Color.Black;
            this.txtLog.Font = new System.Drawing.Font("Consolas", 9F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtLog.ForeColor = System.Drawing.Color.Lime;
            this.txtLog.Location = new System.Drawing.Point(275, 12);
            this.txtLog.Multiline = true;
            this.txtLog.Name = "txtLog";
            this.txtLog.ReadOnly = true;
            this.txtLog.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
            this.txtLog.Size = new System.Drawing.Size(400, 293);
            this.txtLog.TabIndex = 4;
            this.txtLog.Text = "等待操作...\r\n";
            // 
            // timerMonitor
            // 
            this.timerMonitor.Enabled = true;
            this.timerMonitor.Interval = 2000;
            this.timerMonitor.Tick += new System.EventHandler(this.timerMonitor_Tick);
            // 
            // MainForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(687, 317);
            this.Controls.Add(this.txtLog);
            this.Controls.Add(this.grpRegister);
            this.Controls.Add(this.grpStatus);
            this.Controls.Add(this.btnViewStatus);
            this.Controls.Add(this.btnStart);
            this.Name = "MainForm";
            this.Text = "AzerothCore Manager (C#)";
            this.grpStatus.ResumeLayout(false);
            this.grpStatus.PerformLayout();
            this.grpRegister.ResumeLayout(false);
            this.grpRegister.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        private System.Windows.Forms.Button btnStart;
        private System.Windows.Forms.Button btnViewStatus;
        private System.Windows.Forms.GroupBox grpStatus;
        private System.Windows.Forms.Label lblWorldMem;
        private System.Windows.Forms.Label lblAuthMem;
        private System.Windows.Forms.Label lblMysqlMem;
        private System.Windows.Forms.Label lblWorldStatus;
        private System.Windows.Forms.Label lblAuthStatus;
        private System.Windows.Forms.Label lblMysqlStatus;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.GroupBox grpRegister;
        private System.Windows.Forms.CheckBox chkIsGM;
        private System.Windows.Forms.Button btnRegister;
        private System.Windows.Forms.TextBox txtPassword;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.TextBox txtUsername;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.TextBox txtLog;
        private System.Windows.Forms.Timer timerMonitor;
    }
}`;

const App: React.FC = () => {
  const [activeFile, setActiveFile] = useState<string>('README');

  const files = [
    { name: 'README', content: README_TEXT, icon: Info },
    { name: 'MainForm.cs', content: MAINFORM_CS, icon: FileCode },
    { name: 'MainForm.Designer.cs', content: DESIGNER_CS, icon: FileCode },
    { name: 'SRP6.cs', content: SRP6_CS, icon: FileCode },
  ];

  const activeContent = files.find(f => f.name === activeFile)?.content || '';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#1e1e1e] text-[#d4d4d4]">
      {/* Sidebar */}
      <div className="w-64 bg-[#252526] border-r border-[#3e3e42] flex flex-col">
        <div className="p-4 text-xs font-bold text-[#797979] uppercase tracking-wider">Explorer</div>
        <div className="flex-1 overflow-y-auto">
           <div className="px-2 py-1 text-sm font-bold text-[#cccccc]">AC-MANAGER-WINFORMS</div>
           {files.map(file => (
             <div 
               key={file.name}
               onClick={() => setActiveFile(file.name)}
               className={`flex items-center gap-2 px-4 py-1 cursor-pointer text-sm ${activeFile === file.name ? 'bg-[#37373d] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'}`}
             >
               <file.icon size={14} className={file.name.endsWith('cs') ? 'text-[#178600]' : 'text-[#4d92ff]'} />
               {file.name}
             </div>
           ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Tab Bar */}
        <div className="h-9 bg-[#2d2d2d] flex items-center border-b border-[#1e1e1e]">
          {files.map(file => (
             <div 
               key={file.name}
               onClick={() => setActiveFile(file.name)}
               className={`h-full px-4 flex items-center gap-2 text-sm border-r border-[#1e1e1e] cursor-pointer ${activeFile === file.name ? 'bg-[#1e1e1e] text-white' : 'bg-[#2d2d2d] text-[#969696]'}`}
             >
               <file.icon size={14} className={file.name.endsWith('cs') ? 'text-[#178600]' : 'text-[#4d92ff]'} />
               {file.name}
             </div>
          ))}
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-auto relative scrollbar-custom">
           <button 
             onClick={() => navigator.clipboard.writeText(activeContent)}
             className="absolute top-4 right-4 bg-[#3e3e42] hover:bg-[#505055] text-white px-3 py-1.5 rounded text-xs flex items-center gap-2 z-10 transition-colors shadow-lg"
           >
             <Copy size={12} />
             Copy Code
           </button>
           <pre className="p-6 font-mono text-sm leading-relaxed">
             <code>{activeContent}</code>
           </pre>
        </div>
      </div>
    </div>
  );
};

export default App;