using Clubline;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders(); builder.Logging.AddJsonConsole();
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 11 * 1024 * 1024);
var connection = builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Set ConnectionStrings__Database to a PostgreSQL connection string.");
builder.Services.AddScoped<TenantContext>(); builder.Services.AddHttpContextAccessor();
builder.Services.AddDbContext<AppDb>(o => o.UseNpgsql(connection, n => n.CommandTimeout(30)));
builder.Services.AddIdentity<AppUser, IdentityRole>(o =>
{
    o.Password.RequiredLength = 12; o.Password.RequireNonAlphanumeric = true; o.Password.RequireDigit = true; o.Password.RequireUppercase = true;
    o.User.RequireUniqueEmail = true; o.SignIn.RequireConfirmedEmail = true; o.Lockout.MaxFailedAccessAttempts = 5; o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
}).AddEntityFrameworkStores<AppDb>().AddDefaultTokenProviders();
builder.Services.Configure<SecurityStampValidatorOptions>(o => { o.OnRefreshingPrincipal = SessionClaims.RetainServerSession; if (builder.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("App:VerifyStampEveryRequest")) o.ValidationInterval = TimeSpan.Zero; });
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = builder.Environment.IsDevelopment() ? "clubline.session" : "__Host-Clubline.Session";
    o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Lax; o.Cookie.Path = "/";
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromDays(7); o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
    o.Events.OnValidatePrincipal = async c =>
    {
        await SecurityStampValidator.ValidatePrincipalAsync(c); if (c.Principal is null) return;
        var uid = c.Principal.FindFirstValue(ClaimTypes.NameIdentifier); var db = c.HttpContext.RequestServices.GetRequiredService<AppDb>();
        if (!Guid.TryParse(c.Principal.FindFirstValue("sid"), out var id) || !await db.Sessions.AnyAsync(s => s.Id == id && s.UserId == uid && s.RevokedAt == null && s.ExpiresAt > DateTimeOffset.UtcNow))
        { c.RejectPrincipal(); await c.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme); }
    };
});
builder.Services.AddSingleton<ConnectionRegistry>();
builder.Services.Configure<ForwardedHeadersOptions>(o => { o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto; o.ForwardLimit = 3; foreach (var network in builder.Configuration.GetSection("App:TrustedProxyNetworks").Get<string[]>() ?? []) o.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network)); });
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; });
var dataPath = Path.GetFullPath(builder.Configuration["App:DataPath"] ?? "data"); Directory.CreateDirectory(Path.Combine(dataPath, "keys")); Directory.CreateDirectory(Path.Combine(dataPath, "files"));
builder.Services.AddDataProtection().SetApplicationName("Clubline").PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataPath, "keys")));
builder.Services.AddScoped<AutomationService>(); builder.Services.AddScoped<Access>(); builder.Services.AddScoped<Jobs>(); builder.Services.AddScoped<ActivityService>(); builder.Services.AddScoped<MessagingService>(); builder.Services.AddScoped<StripeGateway>();
builder.Services.AddHttpClient("providers", c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddSignalR(o => { o.MaximumReceiveMessageSize = 16 * 1024; o.EnableDetailedErrors = false; });
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.RespectNullableAnnotations = true);
builder.Services.AddOpenApi();
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = builder.Environment.IsDevelopment() ? 1000 : 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("club", c => RateLimitPartition.GetFixedWindowLimiter((c.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? c.Connection.RemoteIpAddress?.ToString() ?? "unknown") + (HttpMethods.IsGet(c.Request.Method) ? ":read" : ":write"), _ => new FixedWindowRateLimiterOptions { PermitLimit = builder.Environment.IsDevelopment() ? 10000 : HttpMethods.IsGet(c.Request.Method) ? 600 : 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("public", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
if (builder.Configuration.GetValue("App:WorkersEnabled", true)) builder.Services.AddHostedService<JobWorker>();
var app = builder.Build();
app.UseForwardedHeaders();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff"; context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers["X-Trace-Id"] = context.TraceIdentifier;
    try { await next(); }
    catch (DomainError ex) { await Results.Problem(statusCode: ex.Status, title: ex.Message, extensions: new Dictionary<string, object?> { ["traceId"] = context.TraceIdentifier }).ExecuteAsync(context); }
    catch (AntiforgeryValidationException) { await Results.Problem(statusCode: 400, title: "Your security token expired. Refresh the page and try again.").ExecuteAsync(context); }
    catch (BadHttpRequestException ex) { await Results.Problem(statusCode: ex.StatusCode, title: "The request body or parameters are invalid.").ExecuteAsync(context); }
    catch (System.Text.Json.JsonException) { await Results.Problem(statusCode: 400, title: "The request body is invalid.").ExecuteAsync(context); }
    catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" or "23503" or "23514" or "23P01" }) { await Results.Problem(statusCode: 409, title: "This operation conflicts with an existing record or booking. Refresh and try again.").ExecuteAsync(context); }
    catch (DbUpdateConcurrencyException) { await Results.Problem(statusCode: 409, title: "The record changed. Refresh it before retrying.").ExecuteAsync(context); }
    catch (Exception ex) { app.Logger.LogError(ex, "Request {TraceId} failed", context.TraceIdentifier); await Results.Problem(statusCode: 500, title: "The service could not complete the request. Your next step is to retry or contact support.", extensions: new Dictionary<string, object?> { ["traceId"] = context.TraceIdentifier }).ExecuteAsync(context); }
});
app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
app.Use(async (context, next) =>
{
    var origin = context.Request.Headers.Origin.ToString();
    var publicOrigin = new Uri(builder.Configuration["App:PublicUrl"] ?? "http://localhost:3000").GetLeftPart(UriPartial.Authority);
    if ((context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/hubs")) && origin.Length > 0 && !string.Equals(origin, publicOrigin, StringComparison.OrdinalIgnoreCase)) throw new DomainError(403, "This request origin is not permitted.");
    if (context.Request.Path.StartsWithSegments("/api") && !context.Request.Path.StartsWithSegments("/api/webhooks") && !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) && !HttpMethods.IsOptions(context.Request.Method)) await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context);
    await next();
});
app.MapGet("/health/live", () => new { status = "live", service = "Clubline API" });
app.MapGet("/health/ready", async (AppDb db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
app.MapAuth(); app.MapClubCreation(); app.MapPublicAndAdmin(); app.MapWebhooks();
var clubs = app.MapGroup("/api/clubs/{clubId:guid}").RequireAuthorization().RequireRateLimiting("club").AddEndpointFilter<ClubFilter>().WithTags("Club operations");
clubs.MapFees(); clubs.MapClubs(); clubs.MapActivities(); clubs.MapMessaging(); clubs.MapBilling(); clubs.MapOperations(); clubs.MapAccounts();
app.MapGet("/api/public/capabilities", (IConfiguration cfg) => new { pushPublicKey = cfg["Push:PublicKey"], aiAvailable = !string.IsNullOrWhiteSpace(cfg["AI:ApiKey"]), emailAvailable = !string.IsNullOrWhiteSpace(cfg["Email:ApiKey"]), demoMode = app.Environment.IsDevelopment() && cfg.GetValue<bool>("App:SeedDemo") });
app.MapHub<ClubHub>("/hubs/chat", o => o.CloseOnAuthenticationExpiration = true).RequireAuthorization();
app.MapOpenApi("/api/openapi/{documentName}.json");
if (args.Contains("--migrate") || args.Contains("--bootstrap-admin") || builder.Configuration.GetValue<bool>("App:MigrateOnStart"))
{
    using var scope = app.Services.CreateScope(); await scope.ServiceProvider.GetRequiredService<AppDb>().Database.MigrateAsync();
    if (args.Contains("--migrate")) return;
}
if (args.Contains("--bootstrap-admin")) {
    using var scope = app.Services.CreateScope(); var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
    var email = Rules.Email(builder.Configuration["Bootstrap:Email"]); var password = builder.Configuration["Bootstrap:Password"] ?? throw new InvalidOperationException("Set Bootstrap__Password using a secret manager.");
    Rules.Check(await users.FindByEmailAsync(email) is null, "Bootstrap refuses to change an existing account.", 409);
    var user = new AppUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = "Platform administrator", IsPlatformAdmin = true };
    var result = await users.CreateAsync(user, password); Rules.Check(result.Succeeded, string.Join(" ", result.Errors.Select(x => x.Description)));
    var db = scope.ServiceProvider.GetRequiredService<AppDb>(); db.PlatformAudits.Add(new PlatformAudit { ActorId = user.Id, Action = "Operator bootstrapped platform administrator" }); await db.SaveChangesAsync(); return;
}
if (app.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("App:SeedDemo"))
{
    using var scope = app.Services.CreateScope(); await DemoSeed.Create(scope.ServiceProvider);
}
app.Run();
public partial class Program { }
