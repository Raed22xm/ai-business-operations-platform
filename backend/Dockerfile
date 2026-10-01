# Multi-stage production build for .NET 10 Web API
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /source

COPY AiBusiness.slnx ./
COPY src/AiBusiness.Api/ src/AiBusiness.Api/
COPY tests/AiBusiness.Api.Tests/ tests/AiBusiness.Api.Tests/

RUN dotnet publish src/AiBusiness.Api/AiBusiness.Api.csproj -c Release -o /app/publish

# Runtime container
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 5222
ENV ASPNETCORE_URLS=http://+:5222 \
    ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "AiBusiness.Api.dll"]
