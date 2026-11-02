FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY api/Clubline.Api/Clubline.Api.csproj ./Clubline.Api/
RUN dotnet restore Clubline.Api/Clubline.Api.csproj
COPY api/Clubline.Api ./Clubline.Api
RUN dotnet publish Clubline.Api/Clubline.Api.csproj -c Release -o /out --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
RUN mkdir -p /data && chown -R $APP_UID:$APP_UID /data
USER $APP_UID
ENV ASPNETCORE_URLS=http://+:8080 App__DataPath=/data
EXPOSE 8080
ENTRYPOINT ["dotnet","Clubline.Api.dll"]
