using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Clubline;
public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<AppDb>
{
    public AppDb CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Database") ?? "Host=localhost;Database=clubline;Username=clubline";
        return new AppDb(new DbContextOptionsBuilder<AppDb>().UseNpgsql(connection).Options, new TenantContext());
    }
}
